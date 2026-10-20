CREATE TABLE IF NOT EXISTS public.gym_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.class_bookings(id) ON DELETE RESTRICT,
  trainer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'ETB' CHECK (currency = 'ETB'),
  status TEXT NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued', 'paid', 'void')),
  note TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  paid_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id),
  CHECK (
    (status = 'paid' AND paid_at IS NOT NULL AND paid_by IS NOT NULL)
    OR (status <> 'paid' AND paid_at IS NULL AND paid_by IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.gym_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gym_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('membership_renewal', 'reengagement', 'announcement', 'system')
  ),
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  action_url TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gym_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gym_commissions, public.gym_announcements, public.gym_notifications
  FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_gym_commissions_trainer_status
  ON public.gym_commissions(gym_id, trainer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gym_announcements_gym_date
  ON public.gym_announcements(gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gym_notifications_recipient
  ON public.gym_notifications(recipient_id, read_at, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_gym_commission(
  p_gym_id UUID,
  p_booking_id UUID,
  p_amount NUMERIC,
  p_note TEXT,
  p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_trainer_id UUID;
  new_commission_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
    RAISE EXCEPTION 'Commission must be an ETB amount greater than zero and at most 1,000,000.' USING ERRCODE = '22023';
  END IF;
  IF p_note IS NOT NULL AND length(p_note) > 500 THEN
    RAISE EXCEPTION 'Commission notes must be 500 characters or fewer.' USING ERRCODE = '22023';
  END IF;
  SELECT c.trainer_id INTO target_trainer_id
  FROM public.class_bookings b
  JOIN public.classes c ON c.id = b.class_id
  JOIN public.gym_staff s ON s.gym_id = c.gym_id AND s.user_id = c.trainer_id
  WHERE b.id = p_booking_id AND c.gym_id = p_gym_id
    AND b.status = 'attended'
    AND s.status = 'active'
    AND s.position IN ('trainer', 'head_trainer');
  IF target_trainer_id IS NULL THEN
    RAISE EXCEPTION 'Commission must reference an attended session led by an active trainer at this gym.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.gym_commissions (
    gym_id, booking_id, trainer_id, amount, note, created_by
  ) VALUES (
    p_gym_id, p_booking_id, target_trainer_id, round(p_amount, 2), NULLIF(btrim(p_note), ''), p_actor_id
  )
  RETURNING id INTO new_commission_id;

  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_actor_id, 'trainer_commission_recorded', 'gym_commission', new_commission_id,
    jsonb_build_object('booking_id', p_booking_id, 'trainer_id', target_trainer_id, 'amount_etb', round(p_amount, 2))
  );
  RETURN new_commission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_gym_commission_paid(
  p_gym_id UUID,
  p_commission_id UUID,
  p_actor_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  commission_row public.gym_commissions%ROWTYPE;
BEGIN
  UPDATE public.gym_commissions
  SET status = 'paid', paid_by = p_actor_id, paid_at = now()
  WHERE id = p_commission_id AND gym_id = p_gym_id AND status = 'accrued'
  RETURNING * INTO commission_row;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_actor_id, 'trainer_commission_paid', 'gym_commission', commission_row.id,
    jsonb_build_object('trainer_id', commission_row.trainer_id, 'amount_etb', commission_row.amount)
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_gym_announcement(
  p_gym_id UUID,
  p_author_id UUID,
  p_title TEXT,
  p_body TEXT
)
RETURNS TABLE (announcement_id UUID, recipient_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_announcement_id UUID;
  inserted_count INTEGER;
BEGIN
  IF length(btrim(COALESCE(p_title, ''))) NOT BETWEEN 1 AND 120
    OR length(btrim(COALESCE(p_body, ''))) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'Announcement title or body is invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gyms WHERE id = p_gym_id AND owner_id = p_author_id
    UNION ALL
    SELECT 1 FROM public.gym_staff
    WHERE gym_id = p_gym_id AND user_id = p_author_id
      AND status = 'active' AND position = 'manager'
    UNION ALL
    SELECT 1 FROM public.users
    WHERE id = p_author_id AND role IN ('admin', 'platform_admin')
  ) THEN
    RAISE EXCEPTION 'Gym announcement publishing permission is required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.gym_announcements (gym_id, author_id, title, body)
  VALUES (p_gym_id, p_author_id, btrim(p_title), btrim(p_body))
  RETURNING id INTO new_announcement_id;

  INSERT INTO public.gym_notifications (
    gym_id, recipient_id, category, title, body, action_url, dedupe_key
  )
  SELECT p_gym_id, audience.member_id, 'announcement', btrim(p_title), btrim(p_body),
    '/notifications', 'announcement:' || new_announcement_id::TEXT || ':' || audience.member_id::TEXT
  FROM (
    SELECT DISTINCT member_id
    FROM public.gym_memberships
    WHERE gym_id = p_gym_id AND status = 'active'
      AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  ) audience
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_author_id, 'gym_announcement_published', 'gym_announcement', new_announcement_id,
    jsonb_build_object('recipient_count', inserted_count)
  );
  RETURN QUERY SELECT new_announcement_id, inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_gym_member_notifications()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  renewal_count INTEGER;
  reengagement_count INTEGER;
BEGIN
  INSERT INTO public.gym_notifications (
    gym_id, recipient_id, category, title, body, action_url, dedupe_key
  )
  SELECT gm.gym_id, gm.member_id, 'membership_renewal', 'Membership renewal approaching',
    'Your membership at ' || g.name || ' ends on ' || to_char(gm.end_date, 'FMMonth FMDD, YYYY') || '. Contact your gym to arrange renewal.',
    '/payments', 'renewal:' || gm.id::TEXT || ':' || gm.end_date::TEXT
  FROM public.gym_memberships gm
  JOIN public.gyms g ON g.id = gm.gym_id
  WHERE gm.status = 'active'
    AND gm.start_date <= CURRENT_DATE
    AND gm.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS renewal_count = ROW_COUNT;

  INSERT INTO public.gym_notifications (
    gym_id, recipient_id, category, title, body, action_url, dedupe_key
  )
  SELECT DISTINCT gm.gym_id, gm.member_id, 'reengagement', 'We miss seeing you',
    'It has been a while since your last visit to ' || g.name || '. Check your schedule and plan your next visit.',
    '/gym', 'reengagement:' || gm.gym_id::TEXT || ':' || gm.member_id::TEXT || ':' ||
      to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM')
  FROM public.gym_memberships gm
  JOIN public.gyms g ON g.id = gm.gym_id
  WHERE gm.status = 'active'
    AND gm.start_date <= CURRENT_DATE
    AND (gm.end_date IS NULL OR gm.end_date >= CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance_logs a
      WHERE a.gym_id = gm.gym_id AND a.member_id = gm.member_id
        AND a.check_in_at >= now() - interval '14 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.class_bookings b
      JOIN public.classes c ON c.id = b.class_id
      WHERE c.gym_id = gm.gym_id AND b.member_id = gm.member_id
        AND b.status = 'attended' AND b.booking_date >= CURRENT_DATE - 14
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.gym_notifications n
      WHERE n.gym_id = gm.gym_id AND n.recipient_id = gm.member_id
        AND n.category = 'reengagement' AND n.created_at >= now() - interval '30 days'
    )
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS reengagement_count = ROW_COUNT;
  RETURN jsonb_build_object(
    'renewal_notifications_queued', renewal_count,
    'reengagement_notifications_queued', reengagement_count
  );
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.gym_commissions TO service_role;
GRANT SELECT, INSERT ON public.gym_announcements TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.gym_notifications TO service_role;
REVOKE ALL ON FUNCTION public.record_gym_commission(UUID, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_gym_commission_paid(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_gym_announcement(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_gym_member_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_gym_commission(UUID, UUID, NUMERIC, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_gym_commission_paid(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_gym_announcement(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_gym_member_notifications() TO service_role;
