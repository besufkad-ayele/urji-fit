ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.gym_leads
  ADD COLUMN IF NOT EXISTS converted_membership_id UUID REFERENCES public.gym_memberships(id) ON DELETE SET NULL;

ALTER TABLE public.gym_waiver_acceptances
  ADD COLUMN IF NOT EXISTS waiver_title TEXT,
  ADD COLUMN IF NOT EXISTS waiver_version INT,
  ADD COLUMN IF NOT EXISTS content_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS content_sha256 CHAR(64);

ALTER TABLE public.gym_memberships
  ALTER COLUMN auto_renew SET DEFAULT false;

CREATE TABLE IF NOT EXISTS public.gym_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gym_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gym_audit_logs_timeline
  ON public.gym_audit_logs(gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gym_audit_logs_target
  ON public.gym_audit_logs(target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gym_households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gym_id, id)
);

CREATE TABLE IF NOT EXISTS public.gym_household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  household_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (gym_id, household_id)
    REFERENCES public.gym_households(gym_id, id) ON DELETE CASCADE,
  UNIQUE (gym_id, member_id),
  UNIQUE (household_id, member_id)
);

ALTER TABLE public.gym_memberships
  DROP CONSTRAINT IF EXISTS gym_memberships_household_id_fkey;
ALTER TABLE public.gym_memberships
  ADD CONSTRAINT gym_memberships_household_id_fkey
  FOREIGN KEY (gym_id, household_id) REFERENCES public.gym_households(gym_id, id) ON DELETE RESTRICT;

ALTER TABLE public.gym_households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_household_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gym_households_gym
  ON public.gym_households(gym_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gym_households_active_primary
  ON public.gym_households(gym_id, primary_member_id)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_gym_household_members_household
  ON public.gym_household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_gym_waiver_acceptances_member
  ON public.gym_waiver_acceptances(member_id, accepted_at DESC);

CREATE OR REPLACE FUNCTION public.create_gym_membership(
  p_gym_id UUID,
  p_member_id UUID,
  p_plan_id UUID,
  p_membership_type TEXT,
  p_price NUMERIC,
  p_start_date DATE,
  p_end_date DATE,
  p_auto_renew BOOLEAN,
  p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_plan public.gym_membership_plans%ROWTYPE;
  membership_type_value TEXT := p_membership_type;
  price_value NUMERIC := p_price;
  end_date_value DATE := p_end_date;
  sessions_value INT;
  created_membership public.gym_memberships%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gyms WHERE id = p_gym_id) THEN
    RAISE EXCEPTION 'Gym not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM public.users WHERE id = p_member_id AND role = 'member' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Select an existing member account.' USING ERRCODE = '22023';
  END IF;
  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO target_plan
    FROM public.gym_membership_plans
    WHERE id = p_plan_id AND gym_id = p_gym_id AND is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose an active plan at this gym.' USING ERRCODE = '22023';
    END IF;
    membership_type_value := target_plan.membership_type;
    price_value := target_plan.price;
    sessions_value := target_plan.sessions_included;
    IF target_plan.duration_days IS NOT NULL THEN
      end_date_value := p_start_date + target_plan.duration_days;
    END IF;
  END IF;

  IF membership_type_value NOT IN (
    'monthly', 'quarterly', 'annual', 'day_pass', 'family', 'corporate',
    'student', 'couple', 'pay_per_visit', 'class_pack'
  ) THEN
    RAISE EXCEPTION 'Choose a valid membership type.' USING ERRCODE = '22023';
  END IF;
  IF price_value IS NULL OR price_value < 0 OR price_value > 1000000 THEN
    RAISE EXCEPTION 'Membership price must be between ETB 0 and ETB 1,000,000.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_auto_renew, false) THEN
    RAISE EXCEPTION 'Automated recurring billing is not available.' USING ERRCODE = '22023';
  END IF;
  IF p_start_date IS NULL OR (end_date_value IS NOT NULL AND end_date_value < p_start_date) THEN
    RAISE EXCEPTION 'Membership end date cannot be before its start date.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.gym_memberships gm
    WHERE gm.gym_id = p_gym_id
      AND gm.member_id = p_member_id
      AND gm.status IN ('active', 'suspended')
      AND (gm.end_date IS NULL OR gm.end_date >= p_start_date)
  ) THEN
    RAISE EXCEPTION 'This member already has a current membership at this gym.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.gym_memberships (
    gym_id, member_id, membership_type, price, start_date, end_date,
    status, auto_renew, sessions_remaining, plan_id
  )
  VALUES (
    p_gym_id, p_member_id, membership_type_value, price_value, p_start_date,
    end_date_value, 'active', false, sessions_value, p_plan_id
  )
  RETURNING * INTO created_membership;

  INSERT INTO public.membership_audit_logs (gym_id, membership_id, actor_id, action, details)
  VALUES (
    p_gym_id, created_membership.id, p_actor_id, 'membership_created',
    jsonb_build_object('member_id', p_member_id, 'plan_id', p_plan_id, 'price_etb', price_value)
  );
  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_actor_id, 'membership_created', 'membership', created_membership.id,
    jsonb_build_object('member_id', p_member_id, 'plan_id', p_plan_id, 'price_etb', price_value)
  );
  RETURN created_membership.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_gym_household(
  p_gym_id UUID,
  p_household_id UUID,
  p_name TEXT,
  p_primary_member_id UUID,
  p_member_ids UUID[],
  p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved_household_id UUID;
  normalized_member_ids UUID[];
BEGIN
  PERFORM 1 FROM public.gyms WHERE id = p_gym_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gym not found.' USING ERRCODE = 'P0002';
  END IF;

  IF p_name IS NULL OR length(btrim(p_name)) = 0 OR length(btrim(p_name)) > 120 THEN
    RAISE EXCEPTION 'Household name must be 1 to 120 characters.' USING ERRCODE = '22023';
  END IF;
  normalized_member_ids := ARRAY(SELECT DISTINCT unnest(COALESCE(p_member_ids, ARRAY[]::UUID[])));
  IF cardinality(normalized_member_ids) < 2 OR NOT (p_primary_member_id = ANY(normalized_member_ids)) THEN
    RAISE EXCEPTION 'Include the primary payer and at least one other household member.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(normalized_member_ids) AS requested(member_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.gym_memberships gm ON gm.member_id = u.id
      WHERE u.id = requested.member_id
        AND u.role = 'member'
        AND gm.gym_id = p_gym_id
        AND gm.status <> 'canceled'
    )
  ) THEN
    RAISE EXCEPTION 'Every household member must have a non-canceled membership at this gym.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.gym_household_members hm
    WHERE hm.gym_id = p_gym_id
      AND hm.member_id = ANY(normalized_member_ids)
      AND hm.household_id IS DISTINCT FROM p_household_id
  ) THEN
    RAISE EXCEPTION 'A member already belongs to another household at this gym.' USING ERRCODE = '23505';
  END IF;

  IF p_household_id IS NULL THEN
    INSERT INTO public.gym_households (gym_id, name, primary_member_id, created_by)
    VALUES (p_gym_id, btrim(p_name), p_primary_member_id, p_actor_id)
    RETURNING id INTO saved_household_id;
  ELSE
    UPDATE public.gym_households
    SET name = btrim(p_name),
        primary_member_id = p_primary_member_id,
        updated_at = now()
    WHERE id = p_household_id AND gym_id = p_gym_id AND is_active = true
    RETURNING id INTO saved_household_id;
    IF saved_household_id IS NULL THEN
      RAISE EXCEPTION 'Household not found.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.gym_household_members
  WHERE household_id = saved_household_id
    AND member_id <> ALL(normalized_member_ids);

  INSERT INTO public.gym_household_members (gym_id, household_id, member_id)
  SELECT p_gym_id, saved_household_id, requested.member_id
  FROM unnest(normalized_member_ids) AS requested(member_id)
  ON CONFLICT (gym_id, member_id) DO UPDATE
    SET household_id = EXCLUDED.household_id;

  UPDATE public.gym_memberships
  SET household_id = NULL
  WHERE gym_id = p_gym_id
    AND household_id = saved_household_id
    AND member_id <> ALL(normalized_member_ids);

  UPDATE public.gym_memberships
  SET household_id = saved_household_id
  WHERE gym_id = p_gym_id
    AND member_id = ANY(normalized_member_ids)
    AND status IN ('active', 'suspended');

  INSERT INTO public.membership_audit_logs (gym_id, actor_id, action, details)
  VALUES (
    p_gym_id,
    p_actor_id,
    CASE WHEN p_household_id IS NULL THEN 'household_created' ELSE 'household_updated' END,
    jsonb_build_object(
      'household_id', saved_household_id,
      'name', btrim(p_name),
      'primary_member_id', p_primary_member_id,
      'member_ids', to_jsonb(normalized_member_ids)
    )
  );
  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_actor_id,
    CASE WHEN p_household_id IS NULL THEN 'household_created' ELSE 'household_updated' END,
    'household', saved_household_id,
    jsonb_build_object('name', btrim(p_name), 'primary_member_id', p_primary_member_id, 'member_ids', to_jsonb(normalized_member_ids))
  );

  RETURN saved_household_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.dissolve_gym_household(
  p_gym_id UUID,
  p_household_id UUID,
  p_actor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  household_name TEXT;
BEGIN
  SELECT name INTO household_name
  FROM public.gym_households
  WHERE id = p_household_id AND gym_id = p_gym_id AND is_active = true
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active household not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.gym_households SET is_active = false, updated_at = now()
  WHERE id = p_household_id;
  UPDATE public.gym_memberships SET household_id = NULL
  WHERE gym_id = p_gym_id AND household_id = p_household_id;
  DELETE FROM public.gym_household_members WHERE household_id = p_household_id;

  INSERT INTO public.membership_audit_logs (gym_id, actor_id, action, details)
  VALUES (
    p_gym_id,
    p_actor_id,
    'household_dissolved',
    jsonb_build_object('household_id', p_household_id, 'name', household_name)
  );
  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (p_gym_id, p_actor_id, 'household_dissolved', 'household', p_household_id, jsonb_build_object('name', household_name));
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_gym_lead(
  p_gym_id UUID,
  p_lead_id UUID,
  p_member_id UUID,
  p_plan_id UUID,
  p_start_date DATE,
  p_actor_id UUID
)
RETURNS TABLE(membership_id UUID, converted_member_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_lead public.gym_leads%ROWTYPE;
  target_member public.users%ROWTYPE;
  target_plan public.gym_membership_plans%ROWTYPE;
  new_membership_id UUID;
  new_end_date DATE;
BEGIN
  SELECT * INTO target_lead
  FROM public.gym_leads
  WHERE id = p_lead_id AND gym_id = p_gym_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found.' USING ERRCODE = 'P0002';
  END IF;
  IF target_lead.status = 'converted' THEN
    RAISE EXCEPTION 'Lead is already converted.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO target_member
  FROM public.users u
  WHERE u.id = p_member_id
    AND u.role = 'member'
    AND (
      (target_lead.email IS NOT NULL AND lower(u.email) = lower(target_lead.email))
      OR (target_lead.phone IS NOT NULL AND u.phone = target_lead.phone)
    )
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Create the member account with the lead phone or email in the admin dashboard before conversion.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO target_plan
  FROM public.gym_membership_plans
  WHERE id = p_plan_id AND gym_id = p_gym_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose an active membership plan for this gym.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gym_memberships gm
    WHERE gm.gym_id = p_gym_id
      AND gm.member_id = p_member_id
      AND gm.status IN ('active', 'suspended')
      AND (gm.end_date IS NULL OR gm.end_date >= p_start_date)
  ) THEN
    RAISE EXCEPTION 'This member already has a current membership at the gym.' USING ERRCODE = '23505';
  END IF;

  IF target_plan.duration_days IS NOT NULL THEN
    new_end_date := p_start_date + target_plan.duration_days;
  END IF;

  INSERT INTO public.gym_memberships (
    gym_id, member_id, membership_type, price, start_date, end_date,
    status, auto_renew, sessions_remaining, plan_id
  )
  VALUES (
    p_gym_id, p_member_id, target_plan.membership_type, target_plan.price,
    p_start_date, new_end_date, 'active', false, target_plan.sessions_included, target_plan.id
  )
  RETURNING id INTO new_membership_id;

  UPDATE public.gym_leads
  SET status = 'converted',
      converted_member_id = p_member_id,
      converted_membership_id = new_membership_id,
      updated_at = now()
  WHERE id = p_lead_id;

  INSERT INTO public.membership_audit_logs (gym_id, membership_id, actor_id, action, details)
  VALUES (
    p_gym_id,
    new_membership_id,
    p_actor_id,
    'lead_conversion',
    jsonb_build_object('lead_id', p_lead_id, 'plan_id', target_plan.id, 'member_id', p_member_id)
  );
  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_actor_id, 'lead_converted', 'lead', p_lead_id,
    jsonb_build_object('member_id', p_member_id, 'membership_id', new_membership_id, 'plan_id', target_plan.id)
  );

  membership_id := new_membership_id;
  converted_member_id := p_member_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_gym_waiver(
  p_gym_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_actor_id UUID
)
RETURNS public.gym_waivers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version INT;
  created_waiver public.gym_waivers%ROWTYPE;
BEGIN
  IF p_title IS NULL OR length(btrim(p_title)) = 0 OR length(btrim(p_title)) > 120 THEN
    RAISE EXCEPTION 'Waiver title must be 1 to 120 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_content IS NULL OR length(btrim(p_content)) = 0 OR length(p_content) > 30000 THEN
    RAISE EXCEPTION 'Waiver content must be 1 to 30,000 characters.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.gyms WHERE id = p_gym_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gym not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.gym_waivers
  WHERE gym_id = p_gym_id;

  UPDATE public.gym_waivers
  SET is_active = false
  WHERE gym_id = p_gym_id AND is_active = true;

  INSERT INTO public.gym_waivers (gym_id, title, content, version, created_by)
  VALUES (p_gym_id, btrim(p_title), p_content, next_version, p_actor_id)
  RETURNING * INTO created_waiver;

  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_actor_id, 'waiver_published', 'waiver', created_waiver.id,
    jsonb_build_object('version', created_waiver.version, 'title', created_waiver.title)
  );
  RETURN created_waiver;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_gym_waiver(
  p_waiver_id UUID,
  p_member_id UUID,
  p_typed_signature TEXT,
  p_content_sha256 CHAR(64)
)
RETURNS public.gym_waiver_acceptances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_waiver public.gym_waivers%ROWTYPE;
  member_name TEXT;
  acceptance public.gym_waiver_acceptances%ROWTYPE;
BEGIN
  SELECT * INTO target_waiver
  FROM public.gym_waivers
  WHERE id = p_waiver_id AND is_active = true
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This waiver is no longer active.' USING ERRCODE = 'P0002';
  END IF;

  SELECT full_name INTO member_name FROM public.users WHERE id = p_member_id AND role = 'member';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member account not found.' USING ERRCODE = '42501';
  END IF;

  IF length(btrim(COALESCE(p_typed_signature, ''))) = 0
    OR lower(btrim(p_typed_signature)) <> lower(btrim(member_name)) THEN
    RAISE EXCEPTION 'Type your account name exactly as your electronic signature.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gym_memberships gm
    WHERE gm.gym_id = target_waiver.gym_id
      AND gm.member_id = p_member_id
      AND gm.status = 'active'
      AND gm.start_date <= CURRENT_DATE
      AND (gm.end_date IS NULL OR gm.end_date >= CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION 'An active gym membership is required to sign this waiver.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.gym_waiver_acceptances (
    waiver_id, member_id, typed_signature, waiver_title, waiver_version,
    content_snapshot, content_sha256
  )
  VALUES (
    target_waiver.id, p_member_id, btrim(p_typed_signature), target_waiver.title,
    target_waiver.version, target_waiver.content, p_content_sha256
  )
  ON CONFLICT (waiver_id, member_id) DO NOTHING
  RETURNING * INTO acceptance;

  IF acceptance.id IS NULL THEN
    RAISE EXCEPTION 'This waiver has already been signed.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    target_waiver.gym_id, p_member_id, 'waiver_signed', 'waiver_acceptance', acceptance.id,
    jsonb_build_object('waiver_id', target_waiver.id, 'version', target_waiver.version, 'content_sha256', p_content_sha256)
  );
  RETURN acceptance;
END;
$$;

REVOKE ALL ON FUNCTION public.save_gym_household(UUID, UUID, TEXT, UUID, UUID[], UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_gym_membership(UUID, UUID, UUID, TEXT, NUMERIC, DATE, DATE, BOOLEAN, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dissolve_gym_household(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convert_gym_lead(UUID, UUID, UUID, UUID, DATE, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_gym_waiver(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_gym_waiver(UUID, UUID, TEXT, CHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_gym_household(UUID, UUID, TEXT, UUID, UUID[], UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_gym_membership(UUID, UUID, UUID, TEXT, NUMERIC, DATE, DATE, BOOLEAN, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.dissolve_gym_household(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.convert_gym_lead(UUID, UUID, UUID, UUID, DATE, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_gym_waiver(UUID, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_gym_waiver(UUID, UUID, TEXT, CHAR) TO service_role;
