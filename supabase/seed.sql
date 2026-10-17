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
INSERT INTO public.gym_memberships (gym_id, member_id, membership_type, price, start_date, end_date, status, auto_renew)
VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'monthly', 1500.00, CURRENT_DATE - 15, CURRENT_DATE + 15, 'active', true),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', 'quarterly', 4000.00, CURRENT_DATE - 30, CURRENT_DATE + 60, 'active', true),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', 'annual', 15000.00, CURRENT_DATE - 60, CURRENT_DATE + 305, 'active', true),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000032', 'monthly', 1200.00, CURRENT_DATE - 10, CURRENT_DATE + 20, 'active', true)
ON CONFLICT DO NOTHING;

-- 9. Insert Trainer Assignments
INSERT INTO public.trainer_assignments (gym_id, trainer_id, client_id, assignment_type, sessions_per_week, session_duration_minutes, start_date, status, notes)
VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000002', 'personal_training', 3, 60, CURRENT_DATE - 14, 'active', 'Focus on strength building and progressive overload'),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000031', 'personal_training', 2, 45, CURRENT_DATE - 20, 'active', 'Injury rehabilitation - lower back'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000032', 'personal_training', 2, 60, CURRENT_DATE - 7, 'active', 'Flexibility and mobility focus')
ON CONFLICT DO NOTHING;

-- 10. Insert Classes
INSERT INTO public.classes (gym_id, trainer_id, name, description, class_type, day_of_week, start_time, duration_minutes, capacity, price, difficulty_level, status)
VALUES
-- Urji Fit Bole Classes
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', 'Morning HIIT', 'High intensity interval training to kickstart your day', 'hiit', 1, '06:00', 45, 25, 0, 'intermediate', 'active'),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000020', 'Evening Strength', 'Build muscle with compound movements', 'strength', 1, '18:00', 60, 20, 0, 'all_levels', 'active'),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021', 'Functional Fitness', 'Real-world movement patterns', 'functional', 3, '17:30', 60, 20, 0, 'intermediate', 'active'),
-- Fitness Hub Classes
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000022', 'Sunrise Yoga', 'Flow yoga to energize your morning', 'yoga', 2, '06:30', 60, 15, 200, 'beginner', 'active'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000022', 'Power Pilates', 'Core strengthening pilates', 'pilates', 4, '18:00', 50, 12, 200, 'intermediate', 'active')
ON CONFLICT DO NOTHING;

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
INSERT INTO public.attendance_logs (gym_id, member_id, check_in_at, check_out_at, attendance_type)
VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', CURRENT_DATE + time '07:30', CURRENT_DATE + time '09:00', 'personal_training'),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', CURRENT_DATE + time '06:00', CURRENT_DATE + time '07:30', 'class'),
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', CURRENT_DATE - 1 + time '17:00', CURRENT_DATE - 1 + time '18:30', 'open_gym'),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000032', CURRENT_DATE + time '06:30', CURRENT_DATE + time '08:00', 'class')
ON CONFLICT DO NOTHING;

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
ON CONFLICT DO NOTHING;

-- 14. Insert Gym Equipment
INSERT INTO public.gym_equipment (gym_id, name, equipment_type, brand, quantity, purchase_date, condition, status)
VALUES
('10000000-0000-0000-0000-000000000001', 'Treadmill', 'cardio', 'Life Fitness', 8, '2024-01-01', 'good', 'active'),
('10000000-0000-0000-0000-000000000001', 'Power Rack', 'strength', 'Rogue', 4, '2024-01-01', 'excellent', 'active'),
('10000000-0000-0000-0000-000000000001', 'Dumbbells Set (5-50kg)', 'free_weights', 'York', 15, '2024-01-01', 'good', 'active'),
('10000000-0000-0000-0000-000000000001', 'Rowing Machine', 'cardio', 'Concept2', 5, '2024-01-15', 'excellent', 'active'),
('10000000-0000-0000-0000-000000000002', 'Assault Bike', 'cardio', 'Rogue', 3, '2024-02-01', 'good', 'active'),
('10000000-0000-0000-0000-000000000002', 'Olympic Barbell', 'strength', 'Rogue', 10, '2024-02-01', 'excellent', 'active'),
('10000000-0000-0000-0000-000000000002', 'Yoga Mat', 'accessories', 'Manduka', 20, '2024-02-10', 'good', 'active')
ON CONFLICT DO NOTHING;

-- 15. Insert Progress Notes
INSERT INTO public.progress_notes (trainer_id, client_id, gym_id, note_date, note_type, content, measurements)
VALUES
('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 
  CURRENT_DATE - 7, 'assessment', 
  'Initial assessment: Good baseline strength. Focus areas: upper body push strength, core stability. Goals: Increase bench press to 100kg in 12 weeks.',
  '{"weight": 82.5, "body_fat": 18.5, "bench_press_1rm": 75}'::jsonb),
('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
  CURRENT_DATE, 'progress',
  'Week 2: Good progress on progressive overload. Bench press up to 80kg. Client reporting good recovery and energy levels.',
  '{"weight": 82.0, "bench_press_5rm": 80}'::jsonb)
ON CONFLICT DO NOTHING;

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

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index) VALUES
('10000000-0000-0000-0000-000000000001', 'Bench Press', '3×8–10', 3, 8, 10, 'https://www.youtube.com/results?search_query=bench+press+proper+form+Jeff+Nippard', 1),
('10000000-0000-0000-0000-000000000001', 'Incline Dumbbell Press', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=incline+dumbbell+press+proper+form', 2),
('10000000-0000-0000-0000-000000000001', 'Cable / Pec-Deck Fly', '3×12–15', 3, 12, 15, 'https://www.youtube.com/results?search_query=pec+deck+fly+proper+form', 3),
('10000000-0000-0000-0000-000000000001', 'Triceps Pushdown', '3×10–15', 3, 10, 15, 'https://www.youtube.com/results?search_query=triceps+pushdown+proper+form', 4),
('10000000-0000-0000-0000-000000000001', 'Overhead Triceps Extension', '2×10–15', 2, 10, 15, 'https://www.youtube.com/results?search_query=overhead+tricep+extension+proper+form', 5);

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

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index) VALUES
('10000000-0000-0000-0000-000000000002', 'Lat Pulldown', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=lat+pulldown+proper+form+Renaissance+Periodization', 1),
('10000000-0000-0000-0000-000000000002', 'Seated Cable Row', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=seated+cable+row+proper+form', 2),
('10000000-0000-0000-0000-000000000002', 'Dumbbell Row', '3×10/side', 3, 10, 10, 'https://www.youtube.com/results?search_query=dumbbell+row+proper+form', 3),
('10000000-0000-0000-0000-000000000002', 'Face Pull', '2×12–15', 2, 12, 15, 'https://www.youtube.com/results?search_query=face+pull+proper+form', 4),
('10000000-0000-0000-0000-000000000002', 'Dumbbell Curl', '3×10–12', 3, 10, 12, 'https://www.youtube.com/results?search_query=bicep+dumbbell+curl+form', 5),
('10000000-0000-0000-0000-000000000002', 'Hammer Curl', '2×10–12', 2, 10, 12, 'https://www.youtube.com/results?search_query=hammer+curl+proper+form', 6);

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

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index) VALUES
('10000000-0000-0000-0000-000000000003', 'Goblet Squat / Barbell Squat', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=squat+proper+form+Squat+University', 1),
('10000000-0000-0000-0000-000000000003', 'Romanian Deadlift', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=romanian+deadlift+proper+form', 2),
('10000000-0000-0000-0000-000000000003', 'Leg Press', '3×10–12', 3, 10, 12, 'https://www.youtube.com/results?search_query=leg+press+proper+form', 3),
('10000000-0000-0000-0000-000000000003', 'Leg Curl', '2×10–15', 2, 10, 15, 'https://www.youtube.com/results?search_query=leg+curl+proper+form', 4),
('10000000-0000-0000-0000-000000000003', 'Standing Calf Raise', '3×12–15', 3, 12, 15, 'https://www.youtube.com/results?search_query=standing+calf+raise+form', 5),
('10000000-0000-0000-0000-000000000003', 'Plank', '3×30–60 sec', 3, 30, 60, 'https://www.youtube.com/results?search_query=plank+proper+form', 6);

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

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index) VALUES
('10000000-0000-0000-0000-000000000004', 'Overhead Press', '3×8–10', 3, 8, 10, 'https://www.youtube.com/results?search_query=overhead+press+proper+form', 1),
('10000000-0000-0000-0000-000000000004', 'Lateral Raise', '3×12–15', 3, 12, 15, 'https://www.youtube.com/results?search_query=lateral+raise+proper+form', 2),
('10000000-0000-0000-0000-000000000004', 'Rear-Delt Fly', '3×12–15', 3, 12, 15, 'https://www.youtube.com/results?search_query=rear+delt+fly+proper+form', 3),
('10000000-0000-0000-0000-000000000004', 'Cable Face Pull', '2×12–15', 2, 12, 15, 'https://www.youtube.com/results?search_query=cable+face+pull+proper+form', 4),
('10000000-0000-0000-0000-000000000004', 'Cable Crunch', '3×10–15', 3, 10, 15, 'https://www.youtube.com/results?search_query=cable+crunch+proper+form', 5);

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

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index) VALUES
('10000000-0000-0000-0000-000000000005', 'Incline Bench Press', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=incline+bench+press+form', 1),
('10000000-0000-0000-0000-000000000005', 'Lat Pulldown', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=lat+pulldown+form', 2),
('10000000-0000-0000-0000-000000000005', 'Machine / Seated Row', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=seated+row+form', 3),
('10000000-0000-0000-0000-000000000005', 'Dumbbell Shoulder Press', '2×8–12', 2, 8, 12, 'https://www.youtube.com/results?search_query=dumbbell+shoulder+press+form', 4),
('10000000-0000-0000-0000-000000000005', 'Biceps Curl', '2×10–12', 2, 10, 12, 'https://www.youtube.com/results?search_query=bicep+curl+form', 5),
('10000000-0000-0000-0000-000000000005', 'Triceps Pushdown', '2×10–15', 2, 10, 15, 'https://www.youtube.com/results?search_query=tricep+pushdown+form', 6);

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

INSERT INTO public.workout_exercises (workout_template_id, name, spec, target_sets, target_reps_min, target_reps_max, video_url, order_index) VALUES
('10000000-0000-0000-0000-000000000006', 'Leg Press / Squat', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=squat+form', 1),
('10000000-0000-0000-0000-000000000006', 'Bench Press', '3×8–10', 3, 8, 10, 'https://www.youtube.com/results?search_query=bench+press+form', 2),
('10000000-0000-0000-0000-000000000006', 'Lat Pulldown', '3×8–12', 3, 8, 12, 'https://www.youtube.com/results?search_query=lat+pulldown+form', 3),
('10000000-0000-0000-0000-000000000006', 'Romanian Deadlift', '2×8–12', 2, 8, 12, 'https://www.youtube.com/results?search_query=romanian+deadlift+form', 4),
('10000000-0000-0000-0000-000000000006', 'Lateral Raise', '2×12–15', 2, 12, 15, 'https://www.youtube.com/results?search_query=lateral+raise+form', 5),
('10000000-0000-0000-0000-000000000006', 'Plank', '3×30–60 sec', 3, 30, 60, 'https://www.youtube.com/results?search_query=plank+form', 6);

-- 17. Seed some initial demo logs for Bes (weight history, meals, hydration, sleep)
INSERT INTO public.body_metrics (user_id, entry_date, weight_kg, waist_cm, is_monthly_checkin)
VALUES 
('00000000-0000-0000-0000-000000000002', CURRENT_DATE - 6, 82.5, 88.5, true),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE - 4, 82.2, 88.0, false),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE - 2, 82.0, 87.8, false),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE, 81.8, 87.5, false);

-- Seed water log for today
INSERT INTO public.water_logs (user_id, log_date, amount_ml)
VALUES 
('00000000-0000-0000-0000-000000000002', CURRENT_DATE, 500),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE, 500),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE, 250);

-- Seed sleep log for last night
INSERT INTO public.sleep_logs (user_id, log_date, bedtime, wake_time, duration_minutes, quality_rating)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  CURRENT_DATE,
  (CURRENT_DATE - 1) + time '23:30',
  CURRENT_DATE + time '07:15',
  465,
  4
);

-- Seed food logs for today
INSERT INTO public.food_logs (user_id, log_date, meal_type, food_name, calories, protein_g, carbs_g, fat_g, portion_desc)
VALUES
('00000000-0000-0000-0000-000000000002', CURRENT_DATE, 'pre-workout', '1 banana + black coffee', 105, 1.3, 27.0, 0.3, '1 medium banana'),
('00000000-0000-0000-0000-000000000002', CURRENT_DATE, 'breakfast', '3 eggs scrambled + oats with berries', 480, 26.0, 45.0, 18.0, '3 whole eggs + 50g rolled oats');
