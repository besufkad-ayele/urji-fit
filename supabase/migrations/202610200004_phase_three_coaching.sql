CREATE TABLE IF NOT EXISTS public.trainer_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description TEXT,
  nutrition_guidance TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trainer_program_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.trainer_programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  target_sets INTEGER NOT NULL CHECK (target_sets BETWEEN 1 AND 20),
  target_reps_min INTEGER NOT NULL CHECK (target_reps_min BETWEEN 1 AND 100),
  target_reps_max INTEGER NOT NULL CHECK (target_reps_max BETWEEN target_reps_min AND 100),
  video_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trainer_program_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.trainer_programs(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, client_id)
);

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS trainer_program_id UUID REFERENCES public.trainer_programs(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.trainer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 4000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (sender_id = trainer_id AND recipient_id = client_id)
    OR (sender_id = client_id AND recipient_id = trainer_id)
  )
);

ALTER TABLE public.trainer_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_program_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_trainer_programs_owner
  ON public.trainer_programs(trainer_id, gym_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trainer_program_assignments_client
  ON public.trainer_program_assignments(client_id, status, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_trainer_program_assignments_trainer
  ON public.trainer_program_assignments(trainer_id, status, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_trainer_messages_thread
  ON public.trainer_messages(gym_id, trainer_id, client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trainer_messages_unread
  ON public.trainer_messages(recipient_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workout_sessions_trainer_program
  ON public.workout_sessions(trainer_program_id, user_id, session_date DESC)
  WHERE trainer_program_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_trainer_program(
  p_trainer_id UUID,
  p_gym_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_nutrition_guidance TEXT,
  p_exercises JSONB,
  p_client_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_program_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.gym_staff
    WHERE gym_id = p_gym_id AND user_id = p_trainer_id
      AND status = 'active' AND position IN ('trainer', 'head_trainer')
  ) THEN
    RAISE EXCEPTION 'An active trainer assignment at this gym is required.' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Program name must be 1 to 120 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 2000 THEN
    RAISE EXCEPTION 'Program description must be 2,000 characters or fewer.' USING ERRCODE = '22023';
  END IF;
  IF p_nutrition_guidance IS NOT NULL AND length(p_nutrition_guidance) > 4000 THEN
    RAISE EXCEPTION 'Nutrition guidance must be 4,000 characters or fewer.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(jsonb_typeof(p_exercises), '') <> 'array' THEN
    RAISE EXCEPTION 'Exercises must be provided as a JSON array.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_exercises) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'A program must include 1 to 60 exercises.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(cardinality(p_client_ids), 0) > 100 THEN
    RAISE EXCEPTION 'A program can be assigned to at most 100 clients at once.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_exercises) e
    WHERE jsonb_typeof(e) <> 'object'
      OR length(btrim(COALESCE(e->>'name', ''))) NOT BETWEEN 1 AND 120
      OR COALESCE((e->>'target_sets')::INTEGER, 0) NOT BETWEEN 1 AND 20
      OR COALESCE((e->>'target_reps_min')::INTEGER, 0) NOT BETWEEN 1 AND 100
      OR COALESCE((e->>'target_reps_max')::INTEGER, 0) NOT BETWEEN
        COALESCE((e->>'target_reps_min')::INTEGER, 1) AND 100
      OR length(COALESCE(e->>'video_url', '')) > 2048
  ) THEN
    RAISE EXCEPTION 'One or more exercise prescriptions are invalid.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_client_ids, ARRAY[]::UUID[])) requested(client_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.trainer_assignments ta
      JOIN public.gym_memberships gm
        ON gm.gym_id = ta.gym_id AND gm.member_id = ta.client_id
      WHERE ta.gym_id = p_gym_id AND ta.trainer_id = p_trainer_id
        AND ta.client_id = requested.client_id AND ta.status = 'active'
        AND gm.status = 'active'
        AND gm.start_date <= CURRENT_DATE
        AND (gm.end_date IS NULL OR gm.end_date >= CURRENT_DATE)
    )
  ) THEN
    RAISE EXCEPTION 'Programs can only be assigned to your active clients with active memberships.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.trainer_programs (
    gym_id, trainer_id, name, description, nutrition_guidance
  )
  VALUES (
    p_gym_id, p_trainer_id, btrim(p_name), NULLIF(btrim(p_description), ''),
    NULLIF(btrim(p_nutrition_guidance), '')
  )
  RETURNING id INTO new_program_id;

  INSERT INTO public.trainer_program_exercises (
    program_id, name, target_sets, target_reps_min, target_reps_max, video_url, order_index
  )
  SELECT new_program_id, btrim(e->>'name'), (e->>'target_sets')::INTEGER,
    (e->>'target_reps_min')::INTEGER, (e->>'target_reps_max')::INTEGER,
    NULLIF(btrim(e->>'video_url'), ''), ordinality::INTEGER - 1
  FROM jsonb_array_elements(p_exercises) WITH ORDINALITY AS rows(e, ordinality);

  INSERT INTO public.trainer_program_assignments (
    program_id, gym_id, trainer_id, client_id
  )
  SELECT new_program_id, p_gym_id, p_trainer_id, selected.client_id
  FROM unnest(COALESCE(p_client_ids, ARRAY[]::UUID[])) AS selected(client_id)
  ON CONFLICT (program_id, client_id) DO NOTHING;

  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_trainer_id, 'trainer_program_created', 'trainer_program', new_program_id,
    jsonb_build_object('exercise_count', jsonb_array_length(p_exercises), 'assigned_client_count', COALESCE(cardinality(p_client_ids), 0))
  );

  RETURN new_program_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_trainer_workout(
  p_member_id UUID,
  p_assignment_id UUID,
  p_notes TEXT,
  p_sets JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_assignment public.trainer_program_assignments%ROWTYPE;
  target_program public.trainer_programs%ROWTYPE;
  session_id UUID;
BEGIN
  SELECT * INTO target_assignment
  FROM public.trainer_program_assignments
  WHERE id = p_assignment_id AND client_id = p_member_id AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active assigned training program is required.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gym_memberships
    WHERE gym_id = target_assignment.gym_id AND member_id = p_member_id
      AND status = 'active' AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION 'An active gym membership is required to log a coached workout.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.trainer_assignments ta
    JOIN public.gym_staff gs
      ON gs.gym_id = ta.gym_id AND gs.user_id = ta.trainer_id
    WHERE ta.gym_id = target_assignment.gym_id
      AND ta.trainer_id = target_assignment.trainer_id
      AND ta.client_id = p_member_id AND ta.status = 'active'
      AND gs.status = 'active' AND gs.position IN ('trainer', 'head_trainer')
  ) THEN
    RAISE EXCEPTION 'An active trainer-client assignment is required to log this workout.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target_program FROM public.trainer_programs
  WHERE id = target_assignment.program_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This training program is no longer active.' USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'Workout notes must be 2,000 characters or fewer.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(jsonb_typeof(p_sets), '') <> 'array' THEN
    RAISE EXCEPTION 'Workout sets must be provided as a JSON array.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_sets) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'A workout log must contain 1 to 100 sets.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_sets) s
    WHERE jsonb_typeof(s) <> 'object'
      OR COALESCE((s->>'reps')::INTEGER, 0) NOT BETWEEN 1 AND 1000
      OR COALESCE((s->>'weight_kg')::NUMERIC, -1) NOT BETWEEN 0 AND 1000
      OR ((s->>'rpe') IS NOT NULL AND (s->>'rpe')::NUMERIC NOT BETWEEN 1 AND 10)
      OR NOT EXISTS (
        SELECT 1 FROM public.trainer_program_exercises e
        WHERE e.id = (s->>'exercise_id')::UUID AND e.program_id = target_program.id
      )
  ) THEN
    RAISE EXCEPTION 'One or more workout sets do not match this program or have invalid values.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.workout_sessions (
    user_id, name, session_date, notes, trainer_program_id
  )
  VALUES (p_member_id, target_program.name, CURRENT_DATE, NULLIF(btrim(p_notes), ''), target_program.id)
  RETURNING id INTO session_id;

  INSERT INTO public.exercise_sets (
    session_id, exercise_name, set_number, weight_kg, reps, rpe, is_completed
  )
  SELECT session_id, e.name,
    row_number() OVER (PARTITION BY e.id ORDER BY submitted.ordinality)::INTEGER,
    (submitted.value->>'weight_kg')::NUMERIC,
    (submitted.value->>'reps')::INTEGER,
    NULLIF(submitted.value->>'rpe', '')::NUMERIC,
    true
  FROM jsonb_array_elements(p_sets) WITH ORDINALITY AS submitted(value, ordinality)
  JOIN public.trainer_program_exercises e ON e.id = (submitted.value->>'exercise_id')::UUID
  WHERE e.program_id = target_program.id;

  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    target_assignment.gym_id, p_member_id, 'coached_workout_logged', 'workout_session', session_id,
    jsonb_build_object('program_id', target_program.id, 'set_count', jsonb_array_length(p_sets))
  );

  RETURN session_id;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.trainer_programs, public.trainer_program_exercises,
    public.trainer_program_assignments, public.trainer_messages
  TO service_role;
GRANT SELECT, INSERT, UPDATE
  ON public.workout_sessions, public.exercise_sets
  TO service_role;
REVOKE ALL ON FUNCTION public.create_trainer_program(UUID, UUID, TEXT, TEXT, TEXT, JSONB, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_trainer_workout(UUID, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_trainer_program(UUID, UUID, TEXT, TEXT, TEXT, JSONB, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_trainer_workout(UUID, UUID, TEXT, JSONB) TO service_role;
