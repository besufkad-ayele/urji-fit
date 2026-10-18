-- ==============================================================================
-- Urji Fit Seeds: Users, Gyms, Trainers, Members, Classes, Demo Data
-- ==============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS certifications TEXT[],
  ADD COLUMN IF NOT EXISTS specializations TEXT[],
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('member', 'trainer', 'gym_owner', 'admin', 'platform_admin')) NOT VALID;

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Ethiopia',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS operating_hours JSONB,
  ADD COLUMN IF NOT EXISTS amenities TEXT[],
  ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS monthly_revenue NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended'));

UPDATE public.gyms
SET slug = 'gym-' || replace(id::text, '-', '')
WHERE slug IS NULL OR btrim(slug) = '';

ALTER TABLE public.gyms
  ALTER COLUMN slug SET DEFAULT ('gym-' || replace(gen_random_uuid()::text, '-', '')),
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gyms_slug ON public.gyms(slug);

ALTER TABLE public.gym_memberships
  ADD COLUMN IF NOT EXISTS membership_type TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS price NUMERIC(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sessions_remaining INT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gym_memberships'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE 'UPDATE public.gym_memberships
      SET member_id = user_id
      WHERE member_id IS NULL AND user_id IS NOT NULL';
    EXECUTE 'ALTER TABLE public.gym_memberships ALTER COLUMN user_id DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gym_memberships'
      AND column_name = 'role'
  ) THEN
    EXECUTE 'ALTER TABLE public.gym_memberships ALTER COLUMN role DROP NOT NULL';
  END IF;
END
$$;

ALTER TABLE public.gym_memberships
  DROP CONSTRAINT IF EXISTS gym_memberships_membership_type_check;
ALTER TABLE public.gym_memberships
  ADD CONSTRAINT gym_memberships_membership_type_check
  CHECK (membership_type IN ('monthly', 'quarterly', 'annual', 'day_pass', 'class_pack')) NOT VALID;

ALTER TABLE public.gym_memberships
  DROP CONSTRAINT IF EXISTS gym_memberships_status_check;
ALTER TABLE public.gym_memberships
  ADD CONSTRAINT gym_memberships_status_check
  CHECK (status IN ('active', 'expired', 'suspended', 'canceled')) NOT VALID;

ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_class_type_check;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_class_type_check
  CHECK (class_type IN ('yoga', 'pilates', 'spin', 'hiit', 'crossfit', 'boxing', 'zumba', 'strength', 'cardio', 'flexibility', 'functional', 'other'));

-- 1. Insert Platform Admin User
-- Seeded accounts are email-only so the seed never claims an existing phone number.
INSERT INTO public.users (id, phone, email, full_name, role, tier, subscription_status, onboarding_completed, disclaimer_acknowledged_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'admin@urjifit.com',
  'Urji Admin',
  'platform_admin',
  'premium',
  'active',
  true,
  now()
) ON CONFLICT DO NOTHING;

-- 2. Insert Demo Gym Owners
INSERT INTO public.users (id, phone, email, full_name, role, tier, subscription_status, onboarding_completed, disclaimer_acknowledged_at, bio, certifications)
VALUES 
(
  '00000000-0000-0000-0000-000000000010',
  NULL,
  'owner@gymone.com',
  'Demo Gym Owner',
  'gym_owner',
  'premium',
  'active',
  true,
  now(),
  'Passionate about fitness and building a community of healthy individuals.',
  ARRAY['Gym Management Certification', 'Business Management']
),
(
  '00000000-0000-0000-0000-000000000011',
  NULL,
  'sarah@fitnesshub.com',
  'Sarah Tadesse',
  'gym_owner',
  'premium',
  'active',
  true,
  now(),
  'Former athlete turned fitness entrepreneur.',
  ARRAY['Sports Science Degree', 'CrossFit Level 2']
) ON CONFLICT DO NOTHING;

-- 3. Insert Demo Trainers
INSERT INTO public.users (id, phone, email, full_name, role, tier, subscription_status, onboarding_completed, disclaimer_acknowledged_at, bio, certifications, specializations, avatar_url)
VALUES 
(
  '00000000-0000-0000-0000-000000000020',
  NULL,
  'coach@urjifit.com',
  'Demo Coach',
  'trainer',
  'premium',
  'active',
  true,
  now(),
  'Certified personal trainer with 5+ years experience in strength and conditioning.',
  ARRAY['NASM-CPT', 'CrossFit Level 1', 'Nutrition Specialist'],
  ARRAY['Strength Training', 'Weight Loss', 'Athletic Performance'],
  null
),
(
  '00000000-0000-0000-0000-000000000021',
  NULL,
  'mike@urjifit.com',
  'Mike Alemayehu',
  'trainer',
  'premium',
  'active',
  true,
  now(),
  'Specializing in functional training and injury rehabilitation.',
  ARRAY['ACE-CPT', 'Functional Movement Screen', 'Corrective Exercise'],
  ARRAY['Functional Training', 'Rehabilitation', 'Mobility'],
  null
),
(
  '00000000-0000-0000-0000-000000000022',
  NULL,
  'ruth@urjifit.com',
  'Ruth Bekele',
  'trainer',
  'premium',
  'active',
  true,
  now(),
  'Yoga instructor and mindfulness coach with holistic approach to fitness.',
  ARRAY['RYT-500', 'Pilates Certification', 'Meditation Teacher'],
  ARRAY['Yoga', 'Pilates', 'Flexibility', 'Mind-Body'],
  null
) ON CONFLICT DO NOTHING;

-- 4. Insert Demo Members
INSERT INTO public.users (id, phone, email, full_name, role, tier, subscription_status, onboarding_completed, disclaimer_acknowledged_at, daily_calorie_target, daily_protein_target, daily_carb_target, daily_fat_target, daily_water_target_ml)
VALUES 
(
  '00000000-0000-0000-0000-000000000002',
  NULL,
  'bes@urjifit.com',
  'Besufikad Ayele',
  'member',
  'premium',
  'active',
  true,
  now(),
  2200,
  160,
  220,
  65,
  3000
),
(
  '00000000-0000-0000-0000-000000000030',
  NULL,
  'member1@urjifit.com',
  'Demo Member',
  'member',
  'premium',
  'active',
  true,
  now(),
  2000,
  150,
  200,
  60,
  2500
),
(
  '00000000-0000-0000-0000-000000000031',
  NULL,
  'john@example.com',
  'John Tesfaye',
  'member',
  'free',
  'active',
  true,
  now(),
  2400,
  180,
  240,
  70,
  3000
),
(
  '00000000-0000-0000-0000-000000000032',
  NULL,
  'marta@example.com',
  'Marta Solomon',
  'member',
  'premium',
  'active',
  true,
  now(),
  1800,
  120,
  180,
  50,
  2500
) ON CONFLICT DO NOTHING;

-- 5. Insert OTPs for all demo users
INSERT INTO public.otps (user_id, code, expires_at)
SELECT seed.user_id, seed.code, now() + interval '30 days'
FROM (VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, '999999'), -- Platform Admin
  ('00000000-0000-0000-0000-000000000010'::uuid, '666666'), -- Gym Owner 1
  ('00000000-0000-0000-0000-000000000011'::uuid, '555555'), -- Gym Owner 2
  ('00000000-0000-0000-0000-000000000020'::uuid, '222222'), -- Coach
  ('00000000-0000-0000-0000-000000000021'::uuid, '333333'), -- Mike
  ('00000000-0000-0000-0000-000000000022'::uuid, '444444'), -- Ruth
  ('00000000-0000-0000-0000-000000000002'::uuid, '123456'), -- Bes (Member)
  ('00000000-0000-0000-0000-000000000030'::uuid, '111111')  -- Demo Member
) AS seed(user_id, code)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.otps existing
  WHERE existing.user_id = seed.user_id
    AND existing.code = seed.code
    AND existing.is_consumed = false
    AND existing.expires_at > now()
);

-- 6. Insert Demo Gyms
INSERT INTO public.gyms (id, name, slug, owner_id, address, city, state, country, phone, email, description, operating_hours, amenities, capacity, monthly_revenue, status)
VALUES
(
  '10000000-0000-0000-0000-000000000001',
  'Urji Fit Bole',
  'urji-fit-bole',
  '00000000-0000-0000-0000-000000000010',
  'Bole Road, Next to Edna Mall',
  'Addis Ababa',
  'Addis Ababa',
  'Ethiopia',
  '+251911234567',
  'bole@urjifit.com',
  'Modern fitness facility with state-of-the-art equipment and expert trainers.',
  '{"monday": "05:00-22:00", "tuesday": "05:00-22:00", "wednesday": "05:00-22:00", "thursday": "05:00-22:00", "friday": "05:00-22:00", "saturday": "06:00-20:00", "sunday": "07:00-18:00"}',
  ARRAY['parking', 'showers', 'lockers', 'wifi', 'cafe', 'sauna', 'pool'],
  150,
  285000.00,
  'active'
),
(
  '10000000-0000-0000-0000-000000000002',
  'Fitness Hub Kazanchis',
  'fitness-hub-kazanchis',
  '00000000-0000-0000-0000-000000000011',
  'Kazanchis Business District',
  'Addis Ababa',
  'Addis Ababa',
  'Ethiopia',
  '+251911234568',
  'kazanchis@fitnesshub.com',
  'CrossFit box with functional training focus and group classes.',
  '{"monday": "06:00-21:00", "tuesday": "06:00-21:00", "wednesday": "06:00-21:00", "thursday": "06:00-21:00", "friday": "06:00-21:00", "saturday": "07:00-19:00", "sunday": "08:00-16:00"}',
  ARRAY['parking', 'showers', 'lockers', 'wifi'],
  80,
  165000.00,
  'active'
)
ON CONFLICT DO NOTHING;

-- 7. Insert Gym Staff (Trainers at Gyms)
INSERT INTO public.gym_staff (gym_id, user_id, position, hire_date, hourly_rate, commission_rate, status)
VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', 'head_trainer', '2024-01-15', 500.00, 15.00, 'active'),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'trainer', '2024-03-01', 350.00, 10.00, 'active'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000022', 'trainer', '2024-02-10', 400.00, 12.00, 'active')
ON CONFLICT DO NOTHING;

-- 8. Insert Gym Memberships
WITH demo_memberships(gym_id, member_email, membership_type, price, start_date, end_date) AS (
  VALUES
    ('10000000-0000-0000-0000-000000000001'::uuid, 'bes@urjifit.com', 'monthly', 1500.00, CURRENT_DATE - 15, CURRENT_DATE + 15),
    ('10000000-0000-0000-0000-000000000001'::uuid, 'member1@urjifit.com', 'quarterly', 4000.00, CURRENT_DATE - 30, CURRENT_DATE + 60),
    ('10000000-0000-0000-0000-000000000001'::uuid, 'john@example.com', 'annual', 15000.00, CURRENT_DATE - 60, CURRENT_DATE + 305),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'marta@example.com', 'monthly', 1200.00, CURRENT_DATE - 10, CURRENT_DATE + 20)
)
INSERT INTO public.gym_memberships (gym_id, member_id, membership_type, price, start_date, end_date, status, auto_renew)
SELECT seed.gym_id, member.id, seed.membership_type, seed.price, seed.start_date, seed.end_date, 'active', true
FROM demo_memberships seed
JOIN public.users member ON member.email = seed.member_email
WHERE NOT EXISTS (
  SELECT 1
  FROM public.gym_memberships existing
  WHERE existing.gym_id = seed.gym_id
    AND existing.member_id = member.id
    AND existing.status = 'active'
);

-- 9. Insert Trainer Assignments
WITH demo_assignments(gym_id, trainer_email, client_email, sessions_per_week, duration_minutes, notes) AS (
  VALUES
    ('10000000-0000-0000-0000-000000000001'::uuid, 'coach@urjifit.com', 'bes@urjifit.com', 3, 60, 'Focus on strength building and progressive overload'),
    ('10000000-0000-0000-0000-000000000001'::uuid, 'coach@urjifit.com', 'member1@urjifit.com', 2, 45, 'Build consistent training habits and improve conditioning'),
    ('10000000-0000-0000-0000-000000000001'::uuid, 'mike@urjifit.com', 'john@example.com', 2, 45, 'Injury rehabilitation - lower back'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'ruth@urjifit.com', 'marta@example.com', 2, 60, 'Flexibility and mobility focus')
)
INSERT INTO public.trainer_assignments (gym_id, trainer_id, client_id, assignment_type, sessions_per_week, session_duration_minutes, start_date, status, notes)
SELECT seed.gym_id, trainer.id, client.id, 'personal_training', seed.sessions_per_week, seed.duration_minutes, CURRENT_DATE - 14, 'active', seed.notes
FROM demo_assignments seed
JOIN public.users trainer ON trainer.email = seed.trainer_email
JOIN public.users client ON client.email = seed.client_email
WHERE NOT EXISTS (
  SELECT 1
  FROM public.trainer_assignments existing
  WHERE existing.gym_id = seed.gym_id
    AND existing.trainer_id = trainer.id
    AND existing.client_id = client.id
    AND existing.status = 'active'
);

-- 10. Insert Classes
WITH demo_classes(gym_id, trainer_email, name, description, class_type, day_of_week, start_time, duration_minutes, capacity, price, difficulty_level) AS (
  VALUES
    ('10000000-0000-0000-0000-000000000001'::uuid, 'coach@urjifit.com', 'Morning HIIT', 'High intensity interval training to kickstart your day', 'hiit', 1, '06:00'::time, 45, 25, 0, 'intermediate'),
    ('10000000-0000-0000-0000-000000000001'::uuid, 'coach@urjifit.com', 'Evening Strength', 'Build muscle with compound movements', 'strength', 1, '18:00'::time, 60, 20, 0, 'all_levels'),
    ('10000000-0000-0000-0000-000000000001'::uuid, 'mike@urjifit.com', 'Functional Fitness', 'Real-world movement patterns', 'functional', 3, '17:30'::time, 60, 20, 0, 'intermediate'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'ruth@urjifit.com', 'Sunrise Yoga', 'Flow yoga to energize your morning', 'yoga', 2, '06:30'::time, 60, 15, 200, 'beginner'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'ruth@urjifit.com', 'Power Pilates', 'Core strengthening pilates', 'pilates', 4, '18:00'::time, 50, 12, 200, 'intermediate')
)
INSERT INTO public.classes (gym_id, trainer_id, name, description, class_type, day_of_week, start_time, duration_minutes, capacity, price, difficulty_level, status)
SELECT seed.gym_id, trainer.id, seed.name, seed.description, seed.class_type, seed.day_of_week, seed.start_time, seed.duration_minutes, seed.capacity, seed.price, seed.difficulty_level, 'active'
FROM demo_classes seed
JOIN public.users trainer ON trainer.email = seed.trainer_email
WHERE NOT EXISTS (
  SELECT 1
  FROM public.classes existing
  WHERE existing.gym_id = seed.gym_id
    AND existing.name = seed.name
);

-- 11. Insert Class Bookings
INSERT INTO public.class_bookings (class_id, member_id, booking_date, status, checked_in_at)
SELECT c.id, m.id::uuid, CURRENT_DATE, 'attended', CURRENT_DATE + c.start_time
FROM public.classes c
CROSS JOIN (VALUES 
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000030')
) m(id)
WHERE c.gym_id = '10000000-0000-0000-0000-000000000001'
LIMIT 4
ON CONFLICT DO NOTHING;

-- 12. Insert Attendance Logs
WITH demo_attendance(member_email, gym_id, day_offset, check_in_time, duration_minutes, attendance_type) AS (
  VALUES
    ('bes@urjifit.com', '10000000-0000-0000-0000-000000000001'::uuid, 0, '07:30'::time, 90, 'personal_training'),
    ('member1@urjifit.com', '10000000-0000-0000-0000-000000000001'::uuid, 0, '06:00'::time, 90, 'class'),
    ('john@example.com', '10000000-0000-0000-0000-000000000001'::uuid, 1, '17:00'::time, 90, 'open_gym'),
    ('marta@example.com', '10000000-0000-0000-0000-000000000002'::uuid, 0, '06:30'::time, 90, 'class')
)
INSERT INTO public.attendance_logs (id, gym_id, member_id, check_in_at, check_out_at, attendance_type)
SELECT
  md5('urji-demo-today-attendance|' || member.id::text || '|' || seed.gym_id::text || '|' || seed.day_offset::text)::uuid,
  seed.gym_id,
  member.id,
  CURRENT_DATE - seed.day_offset + seed.check_in_time,
  CURRENT_DATE - seed.day_offset + seed.check_in_time + make_interval(mins => seed.duration_minutes),
  seed.attendance_type
FROM demo_attendance seed
JOIN public.users member ON member.email = seed.member_email
ON CONFLICT (id) DO NOTHING;

-- 13. Insert Payment Transactions
INSERT INTO public.payment_transactions (gym_id, member_id, membership_id, amount, payment_method, transaction_type, status, payment_date)
SELECT 
  gm.gym_id,
  gm.member_id,
  gm.id,
  gm.price,
  'card',
  'membership_fee',
  'completed',
  gm.start_date
FROM public.gym_memberships gm
WHERE NOT EXISTS (
  SELECT 1
  FROM public.payment_transactions existing
  WHERE existing.membership_id = gm.id
    AND existing.transaction_type = 'membership_fee'
);

-- 14. Insert Gym Equipment
WITH demo_equipment(gym_id, name, equipment_type, brand, quantity, purchase_date, condition) AS (
  VALUES
    ('10000000-0000-0000-0000-000000000001'::uuid, 'Treadmill', 'cardio', 'Life Fitness', 8, '2024-01-01'::date, 'good'),
    ('10000000-0000-0000-0000-000000000001'::uuid, 'Power Rack', 'strength', 'Rogue', 4, '2024-01-01'::date, 'excellent'),
    ('10000000-0000-0000-0000-000000000001'::uuid, 'Dumbbells Set (5-50kg)', 'free_weights', 'York', 15, '2024-01-01'::date, 'good'),
    ('10000000-0000-0000-0000-000000000001'::uuid, 'Rowing Machine', 'cardio', 'Concept2', 5, '2024-01-15'::date, 'excellent'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'Assault Bike', 'cardio', 'Rogue', 3, '2024-02-01'::date, 'good'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'Olympic Barbell', 'strength', 'Rogue', 10, '2024-02-01'::date, 'excellent'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'Yoga Mat', 'accessories', 'Manduka', 20, '2024-02-10'::date, 'good')
)
INSERT INTO public.gym_equipment (gym_id, name, equipment_type, brand, quantity, purchase_date, condition, status)
SELECT seed.gym_id, seed.name, seed.equipment_type, seed.brand, seed.quantity, seed.purchase_date, seed.condition, 'active'
FROM demo_equipment seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.gym_equipment existing
  WHERE existing.gym_id = seed.gym_id
    AND existing.name = seed.name
);

-- 16. Seed 6-Day Workout Program (Global Templates)
-- Template 1: Chest + Triceps (Push - Monday)
INSERT INTO public.workout_templates (id, user_id, name, tag, days, cardio)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  NULL,
  'Chest + Triceps',
  'Push',
  '{1}',
  'Incline treadmill / brisk walk — 12–15 min'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
SELECT * FROM (VALUES
('10000000-0000-0000-0000-000000000001'::uuid, 'Bench Press', '3×8–10', 3, 8, 10, 'https://www.youtube.com/results?search_query=bench+press+proper+form+Jeff+Nippard', 1),
('10000000-0000-0000-0000-000000000001', 'Incline Dumbbell Press', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=incline+dumbbell+press+proper+form', 2),
('10000000-0000-0000-0000-000000000001', 'Cable / Pec-Deck Fly', '3×12–15', 3, 12, 15, 'https://www.youtube.com/results?search_query=pec+deck+fly+proper+form', 3),
('10000000-0000-0000-0000-000000000001', 'Triceps Pushdown', '3×10–15', 3, 10, 15, 'https://www.youtube.com/results?search_query=triceps+pushdown+proper+form', 4),
('10000000-0000-0000-0000-000000000001', 'Overhead Triceps Extension', '2×10–15', 2, 10, 15, 'https://www.youtube.com/results?search_query=overhead+tricep+extension+proper+form', 5)
) AS seed(workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM public.workout_exercises existing
  WHERE existing.workout_template_id = seed.workout_template_id
    AND existing.name = seed.name
);

-- Template 2: Back + Biceps (Pull - Tuesday)
INSERT INTO public.workout_templates (id, user_id, name, tag, days, cardio)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  NULL,
  'Back + Biceps',
  'Pull',
  '{2}',
  'Stationary bike — 10–15 min'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
SELECT * FROM (VALUES
('10000000-0000-0000-0000-000000000002'::uuid, 'Lat Pulldown', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=lat+pulldown+proper+form+Renaissance+Periodization', 1),
('10000000-0000-0000-0000-000000000002', 'Seated Cable Row', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=seated+cable+row+proper+form', 2),
('10000000-0000-0000-0000-000000000002', 'Dumbbell Row', '3×10/side', 3, 10, 10, 'https://www.youtube.com/results?search_query=dumbbell+row+proper+form', 3),
('10000000-0000-0000-0000-000000000002', 'Face Pull', '2×12–15', 2, 12, 15, 'https://www.youtube.com/results?search_query=face+pull+proper+form', 4),
('10000000-0000-0000-0000-000000000002', 'Dumbbell Curl', '3×10–12', 3, 10, 12, 'https://www.youtube.com/results?search_query=bicep+dumbbell+curl+form', 5),
('10000000-0000-0000-0000-000000000002', 'Hammer Curl', '2×10–12', 2, 10, 12, 'https://www.youtube.com/results?search_query=hammer+curl+proper+form', 6)
) AS seed(workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM public.workout_exercises existing
  WHERE existing.workout_template_id = seed.workout_template_id
    AND existing.name = seed.name
);

-- Template 3: Legs + Core (Legs - Wednesday)
INSERT INTO public.workout_templates (id, user_id, name, tag, days, cardio)
VALUES (
  '10000000-0000-0000-0000-000000000003',
  NULL,
  'Legs + Core',
  'Legs',
  '{3}',
  'Easy walk — 10 min'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
SELECT * FROM (VALUES
('10000000-0000-0000-0000-000000000003'::uuid, 'Goblet Squat / Barbell Squat', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=squat+proper+form+Squat+University', 1),
('10000000-0000-0000-0000-000000000003', 'Romanian Deadlift', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=romanian+deadlift+proper+form', 2),
('10000000-0000-0000-0000-000000000003', 'Leg Press', '3×10–12', 3, 10, 12, 'https://www.youtube.com/results?search_query=leg+press+proper+form', 3),
('10000000-0000-0000-0000-000000000003', 'Leg Curl', '2×10–15', 2, 10, 15, 'https://www.youtube.com/results?search_query=leg+curl+proper+form', 4),
('10000000-0000-0000-0000-000000000003', 'Standing Calf Raise', '3×12–15', 3, 12, 15, 'https://www.youtube.com/results?search_query=standing+calf+raise+form', 5),
('10000000-0000-0000-0000-000000000003', 'Plank', '3×30–60 sec', 3, 30, 60, 'https://www.youtube.com/results?search_query=plank+proper+form', 6)
) AS seed(workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM public.workout_exercises existing
  WHERE existing.workout_template_id = seed.workout_template_id
    AND existing.name = seed.name
);

-- Template 4: Shoulders + Core (Push - Thursday)
INSERT INTO public.workout_templates (id, user_id, name, tag, days, cardio)
VALUES (
  '10000000-0000-0000-0000-000000000004',
  NULL,
  'Shoulders + Core',
  'Push',
  '{4}',
  'Intervals — 12 min (easy/hard)'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
SELECT * FROM (VALUES
('10000000-0000-0000-0000-000000000004'::uuid, 'Overhead Press', '3×8–10', 3, 8, 10, 'https://www.youtube.com/results?search_query=overhead+press+proper+form', 1),
('10000000-0000-0000-0000-000000000004', 'Lateral Raise', '3×12–15', 3, 12, 15, 'https://www.youtube.com/results?search_query=lateral+raise+proper+form', 2),
('10000000-0000-0000-0000-000000000004', 'Rear-Delt Fly', '3×12–15', 3, 12, 15, 'https://www.youtube.com/results?search_query=rear+delt+fly+proper+form', 3),
('10000000-0000-0000-0000-000000000004', 'Cable Face Pull', '2×12–15', 2, 12, 15, 'https://www.youtube.com/results?search_query=cable+face+pull+proper+form', 4),
('10000000-0000-0000-0000-000000000004', 'Cable Crunch', '3×10–15', 3, 10, 15, 'https://www.youtube.com/results?search_query=cable+crunch+proper+form', 5)
) AS seed(workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM public.workout_exercises existing
  WHERE existing.workout_template_id = seed.workout_template_id
    AND existing.name = seed.name
);

-- Template 5: Upper Body + Cardio (Full - Friday)
INSERT INTO public.workout_templates (id, user_id, name, tag, days, cardio)
VALUES (
  '10000000-0000-0000-0000-000000000005',
  NULL,
  'Upper Body + Cardio',
  'Full',
  '{5}',
  'Brisk walk — 15–20 min'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
SELECT * FROM (VALUES
('10000000-0000-0000-0000-000000000005'::uuid, 'Incline Bench Press', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=incline+bench+press+form', 1),
('10000000-0000-0000-0000-000000000005', 'Lat Pulldown', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=lat+pulldown+form', 2),
('10000000-0000-0000-0000-000000000005', 'Machine / Seated Row', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=seated+row+form', 3),
('10000000-0000-0000-0000-000000000005', 'Dumbbell Shoulder Press', '2×8–12', 2, 8, 12, 'https://www.youtube.com/results?search_query=dumbbell+shoulder+press+form', 4),
('10000000-0000-0000-0000-000000000005', 'Biceps Curl', '2×10–12', 2, 10, 12, 'https://www.youtube.com/results?search_query=bicep+curl+form', 5),
('10000000-0000-0000-0000-000000000005', 'Triceps Pushdown', '2×10–15', 2, 10, 15, 'https://www.youtube.com/results?search_query=tricep+pushdown+form', 6)
) AS seed(workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM public.workout_exercises existing
  WHERE existing.workout_template_id = seed.workout_template_id
    AND existing.name = seed.name
);

-- Template 6: Full Body + Conditioning (Full - Saturday)
INSERT INTO public.workout_templates (id, user_id, name, tag, days, cardio)
VALUES (
  '10000000-0000-0000-0000-000000000006',
  NULL,
  'Full Body + Conditioning',
  'Full',
  '{6}',
  '15–20 min easy/moderate'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
SELECT * FROM (VALUES
('10000000-0000-0000-0000-000000000006'::uuid, 'Leg Press / Squat', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=squat+form', 1),
('10000000-0000-0000-0000-000000000006', 'Bench Press', '3×8–10', 3, 8, 10, 'https://www.youtube.com/results?search_query=bench+press+form', 2),
('10000000-0000-0000-0000-000000000006', 'Lat Pulldown', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=lat+pulldown+form', 3),
('10000000-0000-0000-0000-000000000006', 'Romanian Deadlift', '2×8–12', 2, 8, 12, 'https://www.youtube.com/results?search_query=romanian+deadlift+form', 4),
('10000000-0000-0000-0000-000000000006', 'Lateral Raise', '2×12–15', 2, 12, 15, 'https://www.youtube.com/results?search_query=lateral+raise+form', 5),
('10000000-0000-0000-0000-000000000006', 'Plank', '3×30–60 sec', 3, 30, 60, 'https://www.youtube.com/results?search_query=plank+form', 6)
) AS seed(workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM public.workout_exercises existing
  WHERE existing.workout_template_id = seed.workout_template_id
    AND existing.name = seed.name
);

-- 17. Rolling year of member health and habit history for Bole demos.
-- Explicit deterministic IDs make generated history safe to seed more than once.
WITH demo_members AS (
  SELECT id, email
  FROM public.users
  WHERE email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
),
demo_dates AS (
  SELECT generated_days.day::date AS log_date
  FROM generate_series(
    (CURRENT_DATE - 364)::timestamp,
    CURRENT_DATE::timestamp,
    interval '1 day'
  ) AS generated_days(day)
)
INSERT INTO public.food_logs (
  id, user_id, log_date, logged_at, meal_type, food_name,
  calories, protein_g, carbs_g, fat_g, portion_desc
)
SELECT
  md5('urji-demo-food|' || member.id::text || '|' || to_char(day.log_date, 'YYYY-MM-DD') || '|' || meal.meal_type)::uuid,
  member.id,
  day.log_date,
  day.log_date + meal.logged_time,
  meal.meal_type,
  meal.food_name,
  meal.calories
    + CASE member.email
        WHEN 'member1@urjifit.com' THEN -180
        WHEN 'john@example.com' THEN 220
        ELSE 0
      END
    + ((extract(doy FROM day.log_date)::int % 3) * 20),
  meal.protein_g
    + CASE member.email
        WHEN 'bes@urjifit.com' THEN 5
        WHEN 'member1@urjifit.com' THEN 1
        WHEN 'john@example.com' THEN 9
        ELSE 0
      END,
  meal.carbs_g,
  meal.fat_g,
  meal.portion_desc
FROM demo_members member
CROSS JOIN demo_dates day
CROSS JOIN (
  VALUES
    ('breakfast'::text, '08:00'::time, 'Eggs, oats and seasonal fruit'::text, 580, 35.0::numeric, 65.0::numeric, 18.0::numeric, 'Eggs, rolled oats and fruit'::text),
    ('lunch'::text, '13:00'::time, 'Injera with lentils and vegetables'::text, 720, 45.0::numeric, 88.0::numeric, 20.0::numeric, 'Injera, misir wot and vegetables'::text),
    ('snack'::text, '16:30'::time, 'Plain yogurt, fruit and a handful of nuts'::text, 220, 20.0::numeric, 25.0::numeric, 6.0::numeric, 'Plain yogurt, seasonal fruit and nuts'::text),
    ('dinner'::text, '19:00'::time, 'Grilled chicken, vegetables and rice'::text, 660, 45.0::numeric, 55.0::numeric, 22.0::numeric, 'Chicken breast, rice and vegetables'::text)
) AS meal(meal_type, logged_time, food_name, calories, protein_g, carbs_g, fat_g, portion_desc)
ON CONFLICT (id) DO NOTHING;

WITH demo_members AS (
  SELECT id
  FROM public.users
  WHERE email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
),
demo_dates AS (
  SELECT generated_days.day::date AS log_date
  FROM generate_series(
    (CURRENT_DATE - 364)::timestamp,
    CURRENT_DATE::timestamp,
    interval '1 day'
  ) AS generated_days(day)
)
INSERT INTO public.water_logs (id, user_id, log_date, logged_at, amount_ml)
SELECT
  md5('urji-demo-water|' || member.id::text || '|' || to_char(day.log_date, 'YYYY-MM-DD') || '|' || hydration.logged_time::text)::uuid,
  member.id,
  day.log_date,
  day.log_date + hydration.logged_time,
  hydration.amount_ml
FROM demo_members member
CROSS JOIN demo_dates day
CROSS JOIN (
  VALUES
    ('07:00'::time, 750),
    ('11:00'::time, 750),
    ('15:00'::time, 1000),
    ('19:00'::time, 500)
) AS hydration(logged_time, amount_ml)
ON CONFLICT (id) DO NOTHING;

WITH demo_members AS (
  SELECT id
  FROM public.users
  WHERE email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
),
demo_dates AS (
  SELECT generated_days.day::date AS log_date
  FROM generate_series(
    (CURRENT_DATE - 364)::timestamp,
    CURRENT_DATE::timestamp,
    interval '1 day'
  ) AS generated_days(day)
)
INSERT INTO public.sleep_logs (
  id, user_id, log_date, bedtime, wake_time, duration_minutes, quality_rating, source
)
SELECT
  md5('urji-demo-sleep|' || member.id::text || '|' || to_char(day.log_date, 'YYYY-MM-DD'))::uuid,
  member.id,
  day.log_date,
  ((day.log_date - 1)::timestamp + time '22:45')::timestamptz,
  (day.log_date::timestamp + time '06:45' + make_interval(mins => (extract(doy FROM day.log_date)::int % 4) * 15))::timestamptz,
  480 + (extract(doy FROM day.log_date)::int % 4) * 15,
  3 + (extract(doy FROM day.log_date)::int % 3),
  'manual'
FROM demo_members member
CROSS JOIN demo_dates day
ON CONFLICT (id) DO NOTHING;

WITH demo_members AS (
  SELECT id
  FROM public.users
  WHERE email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
),
demo_dates AS (
  SELECT generated_days.day::date AS log_date
  FROM generate_series(
    (CURRENT_DATE - 364)::timestamp,
    CURRENT_DATE::timestamp,
    interval '1 day'
  ) AS generated_days(day)
)
INSERT INTO public.fasting_windows (
  id, user_id, preset, target_hours, started_at, ended_at, status, broken_by_food_log_id
)
SELECT
  md5('urji-demo-fasting|' || member.id::text || '|' || to_char(day.log_date, 'YYYY-MM-DD'))::uuid,
  member.id,
  CASE WHEN extract(doy FROM day.log_date)::int % 4 = 0 THEN '18:6' ELSE '16:8' END,
  CASE WHEN extract(doy FROM day.log_date)::int % 4 = 0 THEN 18.0 ELSE 16.0 END,
  ((day.log_date::timestamp + time '08:00') - make_interval(hours => CASE WHEN extract(doy FROM day.log_date)::int % 4 = 0 THEN 18 ELSE 16 END))::timestamptz,
  (day.log_date::timestamp + time '08:00')::timestamptz,
  'completed',
  md5('urji-demo-food|' || member.id::text || '|' || to_char(day.log_date, 'YYYY-MM-DD') || '|breakfast')::uuid
FROM demo_members member
CROSS JOIN demo_dates day
ON CONFLICT (id) DO NOTHING;

WITH demo_members AS (
  SELECT id, email
  FROM public.users
  WHERE email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
),
monthly_dates AS (
  SELECT GREATEST(month_start::date, CURRENT_DATE - 364) AS entry_date
  FROM generate_series(
    date_trunc('month', (CURRENT_DATE - 364)::timestamp),
    date_trunc('month', CURRENT_DATE::timestamp),
    interval '1 month'
  ) AS month_starts(month_start)
),
monthly_metrics AS (
  SELECT member.id AS user_id, monthly.entry_date, true AS is_monthly_checkin
  FROM demo_members member
  CROSS JOIN monthly_dates monthly
),
weekly_metrics AS (
  SELECT member.id AS user_id, generated_days.day::date AS entry_date, false AS is_monthly_checkin
  FROM demo_members member
  CROSS JOIN generate_series(
    (CURRENT_DATE - 364)::timestamp,
    CURRENT_DATE::timestamp,
    interval '1 day'
  ) AS generated_days(day)
  WHERE extract(isodow FROM generated_days.day) = 1
    AND NOT EXISTS (
      SELECT 1
      FROM monthly_metrics monthly
      WHERE monthly.user_id = member.id
        AND monthly.entry_date = generated_days.day::date
    )
),
metric_entries AS (
  SELECT * FROM monthly_metrics
  UNION ALL
  SELECT * FROM weekly_metrics
)
INSERT INTO public.body_metrics (
  id, user_id, entry_date, weight_kg, waist_cm, body_fat_pct, is_monthly_checkin
)
SELECT
  md5('urji-demo-metric|' || member.id::text || '|' || to_char(metric.entry_date, 'YYYY-MM-DD'))::uuid,
  member.id,
  metric.entry_date,
  ROUND((
    CASE member.email
      WHEN 'bes@urjifit.com' THEN 82.5 - ((metric.entry_date - (CURRENT_DATE - 364)) * 4.8 / 364.0)
      WHEN 'member1@urjifit.com' THEN 76.0 - ((metric.entry_date - (CURRENT_DATE - 364)) * 3.2 / 364.0)
      ELSE 91.2 - ((metric.entry_date - (CURRENT_DATE - 364)) * 5.0 / 364.0)
    END
    + ((extract(day FROM metric.entry_date)::int % 5 - 2) * 0.1)
  )::numeric, 2),
  ROUND((
    CASE member.email
      WHEN 'bes@urjifit.com' THEN 88.5 - ((metric.entry_date - (CURRENT_DATE - 364)) * 4.0 / 364.0)
      WHEN 'member1@urjifit.com' THEN 84.0 - ((metric.entry_date - (CURRENT_DATE - 364)) * 2.5 / 364.0)
      ELSE 96.0 - ((metric.entry_date - (CURRENT_DATE - 364)) * 4.5 / 364.0)
    END
  )::numeric, 2),
  ROUND((
    CASE member.email
      WHEN 'bes@urjifit.com' THEN 24.0 - ((metric.entry_date - (CURRENT_DATE - 364)) * 2.0 / 364.0)
      WHEN 'member1@urjifit.com' THEN 27.0 - ((metric.entry_date - (CURRENT_DATE - 364)) * 1.5 / 364.0)
      ELSE 28.0 - ((metric.entry_date - (CURRENT_DATE - 364)) * 2.5 / 364.0)
    END
  )::numeric, 1),
  metric.is_monthly_checkin
FROM metric_entries metric
JOIN demo_members member ON member.id = metric.user_id
ON CONFLICT (id) DO NOTHING;

-- 18. Year of gym, trainer, and workout history centered on Urji Fit Bole.
UPDATE public.gym_memberships membership
SET
  start_date = CURRENT_DATE - 364,
  end_date = CASE member.email
    WHEN 'bes@urjifit.com' THEN CURRENT_DATE + 15
    WHEN 'member1@urjifit.com' THEN CURRENT_DATE + 60
    ELSE CURRENT_DATE + 30
  END,
  updated_at = now()
FROM public.users member
WHERE membership.member_id = member.id
  AND membership.gym_id = '10000000-0000-0000-0000-000000000001'
  AND membership.status = 'active'
  AND member.email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com');

UPDATE public.trainer_assignments assignment
SET start_date = CURRENT_DATE - 364, updated_at = now()
FROM public.users client, public.users trainer
WHERE assignment.client_id = client.id
  AND assignment.trainer_id = trainer.id
  AND assignment.gym_id = '10000000-0000-0000-0000-000000000001'
  AND assignment.status = 'active'
  AND client.email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
  AND trainer.email IN ('coach@urjifit.com', 'mike@urjifit.com');

WITH demo_members AS (
  SELECT id, email
  FROM public.users
  WHERE email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
),
demo_memberships AS (
  SELECT DISTINCT ON (member.id)
    membership.id AS membership_id,
    membership.gym_id,
    membership.member_id,
    membership.membership_type,
    membership.price
  FROM public.gym_memberships membership
  JOIN public.users member ON member.id = membership.member_id
  WHERE membership.gym_id = '10000000-0000-0000-0000-000000000001'
    AND membership.status = 'active'
    AND member.email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
  ORDER BY member.id, membership.created_at, membership.id
),
payment_periods AS (
  SELECT generate_series(0, 11) AS period_index
),
payment_rows AS (
  SELECT
    membership.*,
    periods.period_index,
    LEAST(
      (date_trunc('month', CURRENT_DATE)::date - ((11 - periods.period_index) * interval '1 month') + interval '3 days')::date,
      CURRENT_DATE
    ) AS paid_on
  FROM demo_memberships membership
  CROSS JOIN payment_periods periods
  WHERE membership.membership_type = 'monthly'
     OR (membership.membership_type = 'quarterly' AND periods.period_index % 3 = 0)
     OR (membership.membership_type = 'annual' AND periods.period_index = 0)
)
INSERT INTO public.payment_transactions (
  id, gym_id, member_id, membership_id, amount, payment_method,
  transaction_type, status, payment_date, notes
)
SELECT
  md5('urji-demo-payment|' || payment.membership_id::text || '|' || to_char(payment.paid_on, 'YYYY-MM-DD'))::uuid,
  payment.gym_id,
  payment.member_id,
  payment.membership_id,
  payment.price,
  CASE WHEN payment.period_index % 2 = 0 THEN 'mobile_money' ELSE 'cash' END,
  'membership_fee',
  'completed',
  payment.paid_on::timestamp + time '10:00',
  'Seeded demo membership renewal'
FROM payment_rows payment
ON CONFLICT (id) DO NOTHING;

WITH demo_members AS (
  SELECT id, email,
    CASE email
      WHEN 'bes@urjifit.com' THEN 0
      WHEN 'member1@urjifit.com' THEN 1
      ELSE 2
    END AS member_index
  FROM public.users
  WHERE email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
),
bole_classes AS (
  SELECT DISTINCT ON (gym_id, name)
    id, gym_id, name, day_of_week, start_time, duration_minutes
  FROM public.classes
  WHERE gym_id = '10000000-0000-0000-0000-000000000001'
    AND status = 'active'
  ORDER BY gym_id, name, created_at, id
),
booking_rows AS (
  SELECT
    md5('urji-demo-booking|' || class.id::text || '|' || member.id::text || '|' || to_char(day.class_date, 'YYYY-MM-DD'))::uuid AS id,
    class.id AS class_id,
    member.id AS member_id,
    day.class_date,
    CASE
      WHEN (extract(doy FROM day.class_date)::int + member.member_index + class.day_of_week) % 9 = 0 THEN 'no_show'
      ELSE 'attended'
    END AS booking_status,
    class.start_time
  FROM bole_classes class
  CROSS JOIN generate_series(
    (CURRENT_DATE - 365)::timestamp,
    (CURRENT_DATE - 1)::timestamp,
    interval '1 day'
  ) AS day(class_date)
  CROSS JOIN demo_members member
  WHERE extract(dow FROM day.class_date)::int = class.day_of_week
)
INSERT INTO public.class_bookings (id, class_id, member_id, booking_date, status, checked_in_at)
SELECT
  booking.id,
  booking.class_id,
  booking.member_id,
  booking.class_date,
  booking.booking_status,
  CASE WHEN booking.booking_status = 'attended' THEN booking.class_date + booking.start_time END
FROM booking_rows booking
ON CONFLICT (class_id, member_id, booking_date) DO NOTHING;

INSERT INTO public.attendance_logs (
  id, gym_id, member_id, check_in_at, check_out_at, attendance_type, class_booking_id
)
SELECT
  md5('urji-demo-class-attendance|' || booking.id::text)::uuid,
  class.gym_id,
  booking.member_id,
  booking.checked_in_at,
  booking.checked_in_at + make_interval(mins => class.duration_minutes),
  'class',
  booking.id
FROM public.class_bookings booking
JOIN public.classes class ON class.id = booking.class_id
WHERE booking.id = md5(
    'urji-demo-booking|' || booking.class_id::text || '|' || booking.member_id::text || '|' || to_char(booking.booking_date, 'YYYY-MM-DD')
  )::uuid
  AND booking.status = 'attended'
  AND class.gym_id = '10000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO NOTHING;

WITH demo_members AS (
  SELECT id,
    CASE email
      WHEN 'bes@urjifit.com' THEN 0
      WHEN 'member1@urjifit.com' THEN 1
      ELSE 2
    END AS member_index
  FROM public.users
  WHERE email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
),
open_gym_visits AS (
  SELECT member.id AS member_id, generated_days.day::date AS visit_date, member.member_index
  FROM demo_members member
  CROSS JOIN generate_series(
    (CURRENT_DATE - 365)::timestamp,
    (CURRENT_DATE - 1)::timestamp,
    interval '1 day'
  ) AS generated_days(day)
  WHERE extract(isodow FROM generated_days.day) IN (2, 4, 6)
    AND (member.member_index <> 1 OR extract(isodow FROM generated_days.day) = 6)
    AND (extract(doy FROM generated_days.day)::int + member.member_index) % 4 <> 0
)
INSERT INTO public.attendance_logs (
  id, gym_id, member_id, check_in_at, check_out_at, attendance_type, notes
)
SELECT
  md5('urji-demo-open-gym|' || visit.member_id::text || '|' || to_char(visit.visit_date, 'YYYY-MM-DD'))::uuid,
  '10000000-0000-0000-0000-000000000001',
  visit.member_id,
  visit.visit_date + time '17:30',
  visit.visit_date + time '18:45',
  'open_gym',
  'Seeded demo training visit'
FROM open_gym_visits visit
ON CONFLICT (id) DO NOTHING;

WITH training_dates AS (
  SELECT member.id AS member_id, member.email, generated_days.day::date AS session_date
  FROM public.users member
  CROSS JOIN generate_series(
    (CURRENT_DATE - 364)::timestamp,
    CURRENT_DATE::timestamp,
    interval '1 day'
  ) AS generated_days(day)
  WHERE member.email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
    AND (
      (member.email = 'bes@urjifit.com' AND extract(isodow FROM generated_days.day) IN (1, 3, 5))
      OR (member.email = 'member1@urjifit.com' AND extract(isodow FROM generated_days.day) IN (2, 4))
      OR (member.email = 'john@example.com' AND extract(isodow FROM generated_days.day) IN (1, 5))
    )
)
INSERT INTO public.attendance_logs (
  id, gym_id, member_id, check_in_at, check_out_at, attendance_type, notes
)
SELECT
  md5('urji-demo-training-attendance|' || training.member_id::text || '|' || to_char(training.session_date, 'YYYY-MM-DD'))::uuid,
  '10000000-0000-0000-0000-000000000001',
  training.member_id,
  training.session_date + time '06:00',
  training.session_date + time '07:15',
  'personal_training',
  'Trainer-led strength session'
FROM training_dates training
ON CONFLICT (id) DO NOTHING;

WITH demo_members AS (
  SELECT id, email,
    CASE email
      WHEN 'bes@urjifit.com' THEN 'coach@urjifit.com'
      WHEN 'member1@urjifit.com' THEN 'coach@urjifit.com'
      ELSE 'mike@urjifit.com'
    END AS trainer_email
  FROM public.users
  WHERE email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
),
checkin_months AS (
  SELECT
    generated.month_index,
    (date_trunc('month', CURRENT_DATE)::date - ((11 - generated.month_index) * interval '1 month'))::date AS note_date
  FROM generate_series(0, 11) AS generated(month_index)
)
INSERT INTO public.progress_notes (
  id, trainer_id, client_id, gym_id, note_date, note_type, content, measurements, is_private
)
SELECT
  md5(
    'urji-demo-progress-note|' || trainer.id::text || '|' || member.id::text || '|' ||
    to_char(checkin.note_date, 'YYYY-MM')
  )::uuid,
  trainer.id,
  member.id,
  '10000000-0000-0000-0000-000000000001',
  checkin.note_date,
  CASE WHEN checkin.month_index = 0 THEN 'assessment' ELSE 'progress' END,
  CASE
    WHEN checkin.month_index = 0 THEN 'Baseline assessment completed; reviewed goals, movement quality, and training schedule.'
    ELSE 'Monthly review completed; training consistency and recovery are progressing well. Updated next-month targets.'
  END,
  jsonb_build_object(
    'weight_kg',
    CASE member.email
      WHEN 'bes@urjifit.com' THEN ROUND((82.5 - (checkin.month_index * 4.8 / 11.0))::numeric, 1)
      WHEN 'member1@urjifit.com' THEN ROUND((76.0 - (checkin.month_index * 3.2 / 11.0))::numeric, 1)
      ELSE ROUND((91.2 - (checkin.month_index * 5.0 / 11.0))::numeric, 1)
    END,
    'sessions_per_week', CASE WHEN member.email IN ('member1@urjifit.com', 'john@example.com') THEN 2 ELSE 3 END,
    'review_month', to_char(checkin.note_date, 'YYYY-MM')
  ),
  false
FROM demo_members member
JOIN public.users trainer ON trainer.email = member.trainer_email
CROSS JOIN checkin_months checkin
ON CONFLICT (id) DO NOTHING;

WITH training_dates AS (
  SELECT
    member.id AS user_id,
    member.email,
    generated_days.day::date AS session_date,
    FLOOR((generated_days.day::date - (CURRENT_DATE - 364)) / 7.0)::int AS training_week
  FROM public.users member
  CROSS JOIN generate_series(
    (CURRENT_DATE - 364)::timestamp,
    CURRENT_DATE::timestamp,
    interval '1 day'
  ) AS generated_days(day)
  WHERE member.email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
    AND (
      (member.email = 'bes@urjifit.com' AND extract(isodow FROM generated_days.day) IN (1, 3, 5))
      OR (member.email = 'member1@urjifit.com' AND extract(isodow FROM generated_days.day) IN (2, 4))
      OR (member.email = 'john@example.com' AND extract(isodow FROM generated_days.day) IN (1, 5))
    )
),
training_sessions AS (
  SELECT
    training.user_id,
    training.email,
    training.session_date,
    training.training_week,
    template.id AS template_id,
    template.name AS template_name
  FROM training_dates training
  JOIN public.workout_templates template
    ON template.user_id IS NULL
   AND template.days @> ARRAY[extract(dow FROM training.session_date)::int]
)
INSERT INTO public.workout_sessions (
  id, user_id, workout_template_id, name, session_date, started_at, completed_at, fatigue_rating, notes, created_at
)
SELECT
  md5('urji-demo-workout|' || session.user_id::text || '|' || to_char(session.session_date, 'YYYY-MM-DD') || '|' || session.template_id::text)::uuid,
  session.user_id,
  session.template_id,
  session.template_name,
  session.session_date,
  (session.session_date + time '06:00')::timestamptz,
  (session.session_date + time '07:15')::timestamptz,
  2 + extract(doy FROM session.session_date)::int % 3,
  'Completed scheduled trainer-led demo workout.',
  (session.session_date + time '07:15')::timestamptz
FROM training_sessions session
ON CONFLICT (id) DO NOTHING;

WITH training_dates AS (
  SELECT
    member.id AS user_id,
    member.email,
    generated_days.day::date AS session_date,
    FLOOR((generated_days.day::date - (CURRENT_DATE - 364)) / 7.0)::int AS training_week
  FROM public.users member
  CROSS JOIN generate_series(
    (CURRENT_DATE - 364)::timestamp,
    CURRENT_DATE::timestamp,
    interval '1 day'
  ) AS generated_days(day)
  WHERE member.email IN ('bes@urjifit.com', 'member1@urjifit.com', 'john@example.com')
    AND (
      (member.email = 'bes@urjifit.com' AND extract(isodow FROM generated_days.day) IN (1, 3, 5))
      OR (member.email = 'member1@urjifit.com' AND extract(isodow FROM generated_days.day) IN (2, 4))
      OR (member.email = 'john@example.com' AND extract(isodow FROM generated_days.day) IN (1, 5))
    )
),
training_sessions AS (
  SELECT
    training.user_id,
    training.email,
    training.session_date,
    training.training_week,
    template.id AS template_id
  FROM training_dates training
  JOIN public.workout_templates template
    ON template.user_id IS NULL
   AND template.days @> ARRAY[extract(dow FROM training.session_date)::int]
),
exercise_catalog AS (
  SELECT DISTINCT ON (exercise.workout_template_id, exercise.name)
    exercise.workout_template_id,
    exercise.name,
    exercise.target_sets,
    exercise.target_reps_min,
    exercise.target_reps_max
  FROM public.workout_exercises exercise
  ORDER BY exercise.workout_template_id, exercise.name, exercise.created_at, exercise.id
)
INSERT INTO public.exercise_sets (
  id, session_id, exercise_name, set_number, weight_kg, reps, rpe, is_completed, created_at
)
SELECT
  md5(
    'urji-demo-set|' ||
    md5('urji-demo-workout|' || session.user_id::text || '|' || to_char(session.session_date, 'YYYY-MM-DD') || '|' || session.template_id::text) ||
    '|' || exercise.name || '|' || set_number::text
  )::uuid,
  md5('urji-demo-workout|' || session.user_id::text || '|' || to_char(session.session_date, 'YYYY-MM-DD') || '|' || session.template_id::text)::uuid,
  exercise.name,
  set_number,
  ROUND((
    CASE
      WHEN lower(exercise.name) LIKE '%plank%' THEN 0
      WHEN lower(exercise.name) LIKE '%bench%' OR lower(exercise.name) LIKE '%squat%' THEN 40 + (session.training_week * 0.45)
      WHEN lower(exercise.name) LIKE '%deadlift%' THEN 45 + (session.training_week * 0.5)
      WHEN lower(exercise.name) LIKE '%pulldown%' OR lower(exercise.name) LIKE '%row%' THEN 28 + (session.training_week * 0.35)
      WHEN lower(exercise.name) LIKE '%press%' THEN 18 + (session.training_week * 0.25)
      WHEN lower(exercise.name) LIKE '%raise%' OR lower(exercise.name) LIKE '%fly%' THEN 6 + (session.training_week * 0.12)
      ELSE 12 + (session.training_week * 0.2)
    END
  )::numeric, 2),
  COALESCE(exercise.target_reps_min, 8)
    + (set_number + extract(doy FROM session.session_date)::int)
      % GREATEST(COALESCE(exercise.target_reps_max, 12) - COALESCE(exercise.target_reps_min, 8) + 1, 1),
  7.0 + (set_number % 3) * 0.5,
  true,
  (session.session_date + time '06:30')::timestamptz
FROM training_sessions session
JOIN exercise_catalog exercise ON exercise.workout_template_id = session.template_id
CROSS JOIN LATERAL generate_series(1, GREATEST(COALESCE(exercise.target_sets, 3), 1)) AS set_numbers(set_number)
ON CONFLICT (id) DO NOTHING;
