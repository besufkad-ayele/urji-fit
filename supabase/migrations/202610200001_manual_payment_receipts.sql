ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS mobile_money_provider TEXT,
  ADD COLUMN IF NOT EXISTS mobile_money_account TEXT,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'ETB',
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS receipt_path TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE TABLE IF NOT EXISTS public.gym_membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  membership_type TEXT NOT NULL CHECK (
    membership_type IN ('monthly', 'quarterly', 'annual', 'day_pass', 'family', 'corporate', 'student', 'couple', 'pay_per_visit', 'class_pack')
  ),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  duration_days INT,
  sessions_included INT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gym_id, name)
);

ALTER TABLE public.gym_memberships
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.gym_membership_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_plan_id UUID REFERENCES public.gym_membership_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS household_id UUID;

ALTER TABLE public.gym_memberships
  DROP CONSTRAINT IF EXISTS gym_memberships_membership_type_check;
ALTER TABLE public.gym_memberships
  ADD CONSTRAINT gym_memberships_membership_type_check
  CHECK (membership_type IN (
    'monthly', 'quarterly', 'annual', 'day_pass', 'family', 'corporate',
    'student', 'couple', 'pay_per_visit', 'class_pack'
  ));

CREATE TABLE IF NOT EXISTS public.membership_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES public.gym_memberships(id) ON DELETE SET NULL,
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gym_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'inquiry' CHECK (status IN ('inquiry', 'trial', 'converted', 'lost')),
  trial_at TIMESTAMPTZ,
  notes TEXT,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  converted_member_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.member_profiles (
  member_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  medical_notes TEXT,
  goals TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gym_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gym_id, version)
);

CREATE TABLE IF NOT EXISTS public.gym_waiver_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_id UUID NOT NULL REFERENCES public.gym_waivers(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  typed_signature TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  UNIQUE (waiver_id, member_id)
);

ALTER TABLE public.class_bookings
  DROP CONSTRAINT IF EXISTS class_bookings_status_check;
ALTER TABLE public.class_bookings
  ADD CONSTRAINT class_bookings_status_check
  CHECK (status IN ('booked', 'waitlisted', 'attended', 'no_show', 'canceled'));

CREATE OR REPLACE FUNCTION public.book_class(
  p_class_id UUID,
  p_member_id UUID,
  p_booking_date DATE
)
RETURNS TABLE(booking_id UUID, booking_status TEXT, waitlist_position INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_class public.classes%ROWTYPE;
  existing_booking public.class_bookings%ROWTYPE;
  active_count INT;
  next_status TEXT;
  next_position INT;
BEGIN
  SELECT * INTO target_class
  FROM public.classes
  WHERE id = p_class_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class is not available.' USING ERRCODE = 'P0002';
  END IF;
  IF p_booking_date <= CURRENT_DATE
    OR EXTRACT(DOW FROM p_booking_date)::INT <> target_class.day_of_week THEN
    RAISE EXCEPTION 'Choose a future date that matches the class schedule.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(target_class.price, 0) > 0 THEN
    RAISE EXCEPTION 'Paid classes must be booked at the gym until payment verification is supported.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gym_memberships gm
    WHERE gm.gym_id = target_class.gym_id
      AND gm.member_id = p_member_id
      AND gm.status = 'active'
      AND gm.start_date <= p_booking_date
      AND (gm.end_date IS NULL OR gm.end_date >= p_booking_date)
  ) THEN
    RAISE EXCEPTION 'An active membership is required for this class date.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO existing_booking
  FROM public.class_bookings cb
  WHERE cb.class_id = p_class_id
    AND cb.member_id = p_member_id
    AND cb.booking_date = p_booking_date
  FOR UPDATE;

  IF FOUND AND existing_booking.status <> 'canceled' THEN
    booking_id := existing_booking.id;
    booking_status := existing_booking.status;
    IF existing_booking.status = 'waitlisted' THEN
      SELECT COUNT(*)::INT INTO waitlist_position
      FROM public.class_bookings cb
      WHERE cb.class_id = p_class_id
        AND cb.booking_date = p_booking_date
        AND cb.status = 'waitlisted'
        AND (cb.created_at, cb.id) <= (existing_booking.created_at, existing_booking.id);
    ELSE
      waitlist_position := NULL;
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COUNT(*)::INT INTO active_count
  FROM public.class_bookings cb
  WHERE cb.class_id = p_class_id
    AND cb.booking_date = p_booking_date
    AND cb.status IN ('booked', 'attended', 'no_show');

  IF active_count < COALESCE(target_class.capacity, 500000) THEN
    next_status := 'booked';
    next_position := NULL;
  ELSE
    next_status := 'waitlisted';
    SELECT COUNT(*)::INT + 1 INTO next_position
    FROM public.class_bookings cb
    WHERE cb.class_id = p_class_id
      AND cb.booking_date = p_booking_date
      AND cb.status = 'waitlisted';
  END IF;

  IF FOUND AND existing_booking.status = 'canceled' THEN
    UPDATE public.class_bookings
    SET status = next_status, created_at = now()
    WHERE id = existing_booking.id
    RETURNING id INTO booking_id;
  ELSE
    INSERT INTO public.class_bookings (class_id, member_id, booking_date, status)
    VALUES (p_class_id, p_member_id, p_booking_date, next_status)
    RETURNING id INTO booking_id;
  END IF;

  booking_status := next_status;
  waitlist_position := next_position;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_class_booking(
  p_class_id UUID,
  p_member_id UUID,
  p_booking_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  canceled_booking public.class_bookings%ROWTYPE;
  next_booking_id UUID;
  class_status TEXT;
BEGIN
  SELECT status INTO class_status FROM public.classes WHERE id = p_class_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO canceled_booking
  FROM public.class_bookings cb
  WHERE cb.class_id = p_class_id
    AND cb.member_id = p_member_id
    AND cb.booking_date = p_booking_date
    AND cb.status IN ('booked', 'waitlisted')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active booking was not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.class_bookings SET status = 'canceled' WHERE id = canceled_booking.id;
  IF canceled_booking.status = 'booked' AND class_status = 'active' THEN
    SELECT cb.id INTO next_booking_id
    FROM public.class_bookings cb
    WHERE cb.class_id = p_class_id
      AND cb.booking_date = p_booking_date
      AND cb.status = 'waitlisted'
    ORDER BY cb.created_at, cb.id
    LIMIT 1
    FOR UPDATE;
    IF next_booking_id IS NOT NULL THEN
      UPDATE public.class_bookings SET status = 'booked' WHERE id = next_booking_id;
    END IF;
  END IF;
  RETURN next_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.book_class(UUID, UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_class_booking(UUID, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_class(UUID, UUID, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_class_booking(UUID, UUID, DATE) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_gym_reference
  ON public.payment_transactions(gym_id, reference_number)
  WHERE reference_number IS NOT NULL;

DROP POLICY IF EXISTS "Allow all actions on users" ON public.users;
DROP POLICY IF EXISTS "Allow all actions on otps" ON public.otps;
DROP POLICY IF EXISTS "Allow all actions on gyms" ON public.gyms;
DROP POLICY IF EXISTS "Allow all actions on gym_staff" ON public.gym_staff;
DROP POLICY IF EXISTS "Allow all actions on gym_memberships" ON public.gym_memberships;
DROP POLICY IF EXISTS "Allow all actions on trainer_assignments" ON public.trainer_assignments;
DROP POLICY IF EXISTS "Allow all actions on classes" ON public.classes;
DROP POLICY IF EXISTS "Allow all actions on class_bookings" ON public.class_bookings;
DROP POLICY IF EXISTS "Allow all actions on attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow all actions on payment_transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Allow all actions on gym_equipment" ON public.gym_equipment;
DROP POLICY IF EXISTS "Allow all actions on progress_notes" ON public.progress_notes;
ALTER TABLE public.gym_membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_waiver_acceptances ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gym_membership_plans_active
  ON public.gym_membership_plans(gym_id, is_active);
CREATE INDEX IF NOT EXISTS idx_gym_leads_pipeline
  ON public.gym_leads(gym_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_audit_logs_membership
  ON public.membership_audit_logs(membership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_bookings_schedule
  ON public.class_bookings(class_id, booking_date, status, created_at);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
