-- ==============================================================================
-- Urji Fit Database Schema for Supabase PostgreSQL
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Admin-provisioned, device-locked)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'trainer', 'gym_owner', 'admin', 'platform_admin')),
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'expired', 'canceled', 'trial')),
  subscription_expires_at TIMESTAMPTZ,
  current_device_id TEXT,
  device_name TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  disclaimer_acknowledged_at TIMESTAMPTZ,
  onboarding_completed BOOLEAN DEFAULT false,
  daily_calorie_target INT DEFAULT 2000,
  daily_protein_target INT DEFAULT 150,
  daily_carb_target INT DEFAULT 200,
  daily_fat_target INT DEFAULT 60,
  daily_water_target_ml INT DEFAULT 2500,
  target_bedtime TEXT DEFAULT '23:00',
  target_waketime TEXT DEFAULT '07:00',
  wind_down_offset_minutes INT DEFAULT 60,
  avatar_url TEXT,
  bio TEXT,
  certifications TEXT[],
  specializations TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- 2. Single-use OTPs for admin-provisioned auth
CREATE TABLE IF NOT EXISTS public.otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  device_id TEXT,
  is_consumed BOOLEAN DEFAULT false,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Workout Templates
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL for global/system templates
  name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'Custom',
  days INT[] DEFAULT '{}', -- 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
  cardio TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Workout Exercises within Templates
CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_template_id UUID NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  spec TEXT NOT NULL DEFAULT '3×8–12',
  target_sets INT DEFAULT 3,
  target_reps_min INT DEFAULT 8,
  target_reps_max INT DEFAULT 12,
  video_url TEXT,
  music_url TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Workout Performed Sessions
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workout_template_id UUID REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  fatigue_rating INT CHECK (fatigue_rating BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Exercise Sets Logged
CREATE TABLE IF NOT EXISTS public.exercise_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  set_number INT NOT NULL,
  weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 0,
  reps INT NOT NULL DEFAULT 0,
  rpe NUMERIC(3, 1),
  is_completed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Progressive Overload Suggestions
CREATE TABLE IF NOT EXISTS public.progression_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  previous_weight_kg NUMERIC(6, 2) NOT NULL,
  suggested_weight_kg NUMERIC(6, 2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Food & Nutrition Logs
CREATE TABLE IF NOT EXISTS public.food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at TIMESTAMPTZ DEFAULT now(),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('pre-workout', 'breakfast', 'lunch', 'snack', 'dinner', 'other')),
  food_name TEXT NOT NULL,
  calories INT NOT NULL DEFAULT 0,
  protein_g NUMERIC(6, 1) DEFAULT 0,
  carbs_g NUMERIC(6, 1) DEFAULT 0,
  fat_g NUMERIC(6, 1) DEFAULT 0,
  portion_desc TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Fasting Windows
CREATE TABLE IF NOT EXISTS public.fasting_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  preset TEXT NOT NULL DEFAULT '16:8',
  target_hours NUMERIC(4, 1) NOT NULL DEFAULT 16.0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'canceled')),
  broken_by_food_log_id UUID REFERENCES public.food_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Water Logs
CREATE TABLE IF NOT EXISTS public.water_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at TIMESTAMPTZ DEFAULT now(),
  amount_ml INT NOT NULL DEFAULT 250,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Sleep Logs
CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bedtime TIMESTAMPTZ NOT NULL,
  wake_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  quality_rating INT CHECK (quality_rating BETWEEN 1 AND 5),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'healthkit', 'google_fit')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Body Metrics & Monthly Check-ins
CREATE TABLE IF NOT EXISTS public.body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at TIMESTAMPTZ DEFAULT now(),
  weight_kg NUMERIC(5, 2) NOT NULL,
  waist_cm NUMERIC(5, 2),
  body_fat_pct NUMERIC(4, 1),
  is_monthly_checkin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- GYM MANAGEMENT SYSTEM TABLES
-- ==============================================================================

-- 13. Gyms (Locations/Facilities)
CREATE TABLE IF NOT EXISTS public.gyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT ('gym-' || replace(gen_random_uuid()::text, '-', '')),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'Ethiopia',
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  description TEXT,
  operating_hours JSONB, -- e.g., {"monday": "06:00-22:00", "tuesday": "06:00-22:00"}
  amenities TEXT[], -- ["parking", "showers", "lockers", "wifi", "cafe"]
  capacity INT DEFAULT 100,
  monthly_revenue NUMERIC(10, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- 14. Gym Staff (Trainers, Receptionists, etc.)
CREATE TABLE IF NOT EXISTS public.gym_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position TEXT NOT NULL CHECK (position IN ('trainer', 'head_trainer', 'receptionist', 'manager', 'maintenance')),
  hire_date DATE DEFAULT CURRENT_DATE,
  hourly_rate NUMERIC(8, 2),
  salary NUMERIC(10, 2),
  commission_rate NUMERIC(4, 2), -- percentage, e.g., 15.00 for 15%
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'terminated')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(gym_id, user_id)
);

-- 15. Gym Memberships
CREATE TABLE IF NOT EXISTS public.gym_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  membership_type TEXT NOT NULL CHECK (membership_type IN ('monthly', 'quarterly', 'annual', 'day_pass', 'class_pack')),
  price NUMERIC(8, 2) NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended', 'canceled')),
  auto_renew BOOLEAN DEFAULT true,
  sessions_remaining INT, -- for class packs
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- 16. Trainer-Client Assignments
CREATE TABLE IF NOT EXISTS public.trainer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL DEFAULT 'personal_training' CHECK (assignment_type IN ('personal_training', 'group_training', 'nutrition_coaching')),
  sessions_per_week INT DEFAULT 3,
  session_duration_minutes INT DEFAULT 60,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'canceled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 17. Classes/Group Sessions
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  class_type TEXT NOT NULL CHECK (class_type IN ('yoga', 'pilates', 'spin', 'hiit', 'crossfit', 'boxing', 'zumba', 'strength', 'cardio', 'flexibility', 'functional', 'other')),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  capacity INT DEFAULT 20,
  price NUMERIC(6, 2) DEFAULT 0, -- 0 if included in membership
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'all_levels')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'full')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_class_type_check;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_class_type_check
  CHECK (class_type IN ('yoga', 'pilates', 'spin', 'hiit', 'crossfit', 'boxing', 'zumba', 'strength', 'cardio', 'flexibility', 'functional', 'other'));

-- 18. Class Bookings
CREATE TABLE IF NOT EXISTS public.class_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'attended', 'no_show', 'canceled')),
  checked_in_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, member_id, booking_date)
);

-- 19. Attendance Logs (for both classes and open gym)
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out_at TIMESTAMPTZ,
  attendance_type TEXT NOT NULL DEFAULT 'open_gym' CHECK (attendance_type IN ('open_gym', 'class', 'personal_training')),
  class_booking_id UUID REFERENCES public.class_bookings(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 20. Payment Transactions
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES public.gym_memberships(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile_money', 'bank_transfer', 'other')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('membership_fee', 'class_pack', 'personal_training', 'day_pass', 'merchandise', 'other')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_date TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 21. Gym Equipment Inventory
CREATE TABLE IF NOT EXISTS public.gym_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  equipment_type TEXT NOT NULL CHECK (equipment_type IN ('cardio', 'strength', 'free_weights', 'functional', 'accessories', 'other')),
  brand TEXT,
  model TEXT,
  quantity INT DEFAULT 1,
  purchase_date DATE,
  purchase_price NUMERIC(10, 2),
  condition TEXT DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'broken')),
  maintenance_schedule TEXT, -- e.g., "monthly", "quarterly"
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 22. Member Progress Notes (Trainer observations)
CREATE TABLE IF NOT EXISTS public.progress_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE,
  note_date DATE DEFAULT CURRENT_DATE,
  note_type TEXT CHECK (note_type IN ('assessment', 'progress', 'injury', 'goal_update', 'general')),
  content TEXT NOT NULL,
  measurements JSONB, -- {"weight": 75, "body_fat": 18.5, "muscle_mass": 62}
  photos TEXT[], -- URLs to progress photos
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) on all public tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progression_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fasting_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_notes ENABLE ROW LEVEL SECURITY;

-- Allow read/write for service_role (bypasses RLS) and create permissive policy for users
-- Note: Service role has full access by default. We add policies for authenticated user access.
DROP POLICY IF EXISTS "Allow public read of templates" ON public.workout_templates;
CREATE POLICY "Allow public read of templates" ON public.workout_templates FOR SELECT USING (user_id IS NULL OR true);
DROP POLICY IF EXISTS "Allow public read of exercises" ON public.workout_exercises;
CREATE POLICY "Allow public read of exercises" ON public.workout_exercises FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all actions on users" ON public.users;
CREATE POLICY "Allow all actions on users" ON public.users FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on otps" ON public.otps;
CREATE POLICY "Allow all actions on otps" ON public.otps FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on workout_templates" ON public.workout_templates;
CREATE POLICY "Allow all actions on workout_templates" ON public.workout_templates FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on workout_exercises" ON public.workout_exercises;
CREATE POLICY "Allow all actions on workout_exercises" ON public.workout_exercises FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on workout_sessions" ON public.workout_sessions;
CREATE POLICY "Allow all actions on workout_sessions" ON public.workout_sessions FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on exercise_sets" ON public.exercise_sets;
CREATE POLICY "Allow all actions on exercise_sets" ON public.exercise_sets FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on progression_suggestions" ON public.progression_suggestions;
CREATE POLICY "Allow all actions on progression_suggestions" ON public.progression_suggestions FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on food_logs" ON public.food_logs;
CREATE POLICY "Allow all actions on food_logs" ON public.food_logs FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on fasting_windows" ON public.fasting_windows;
CREATE POLICY "Allow all actions on fasting_windows" ON public.fasting_windows FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on water_logs" ON public.water_logs;
CREATE POLICY "Allow all actions on water_logs" ON public.water_logs FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on sleep_logs" ON public.sleep_logs;
CREATE POLICY "Allow all actions on sleep_logs" ON public.sleep_logs FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on body_metrics" ON public.body_metrics;
CREATE POLICY "Allow all actions on body_metrics" ON public.body_metrics FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on gyms" ON public.gyms;
CREATE POLICY "Allow all actions on gyms" ON public.gyms FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on gym_staff" ON public.gym_staff;
CREATE POLICY "Allow all actions on gym_staff" ON public.gym_staff FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on gym_memberships" ON public.gym_memberships;
CREATE POLICY "Allow all actions on gym_memberships" ON public.gym_memberships FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on trainer_assignments" ON public.trainer_assignments;
CREATE POLICY "Allow all actions on trainer_assignments" ON public.trainer_assignments FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on classes" ON public.classes;
CREATE POLICY "Allow all actions on classes" ON public.classes FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on class_bookings" ON public.class_bookings;
CREATE POLICY "Allow all actions on class_bookings" ON public.class_bookings FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow all actions on attendance_logs" ON public.attendance_logs FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on payment_transactions" ON public.payment_transactions;
CREATE POLICY "Allow all actions on payment_transactions" ON public.payment_transactions FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on gym_equipment" ON public.gym_equipment;
CREATE POLICY "Allow all actions on gym_equipment" ON public.gym_equipment FOR ALL USING (true);
DROP POLICY IF EXISTS "Allow all actions on progress_notes" ON public.progress_notes;
CREATE POLICY "Allow all actions on progress_notes" ON public.progress_notes FOR ALL USING (true);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_otps_code_user ON public.otps(code, user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON public.workout_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON public.food_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON public.water_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_date ON public.sleep_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_body_metrics_user_date ON public.body_metrics(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_gyms_owner ON public.gyms(owner_id);
CREATE INDEX IF NOT EXISTS idx_gyms_status ON public.gyms(status);
CREATE INDEX IF NOT EXISTS idx_gym_staff_gym ON public.gym_staff(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_staff_user ON public.gym_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_memberships_gym ON public.gym_memberships(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_memberships_member ON public.gym_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_gym_memberships_status ON public.gym_memberships(status);
CREATE INDEX IF NOT EXISTS idx_trainer_assignments_trainer ON public.trainer_assignments(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_assignments_client ON public.trainer_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_classes_gym ON public.classes(gym_id);
CREATE INDEX IF NOT EXISTS idx_classes_trainer ON public.classes(trainer_id);
CREATE INDEX IF NOT EXISTS idx_classes_day_time ON public.classes(day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_class_bookings_class ON public.class_bookings(class_id);
CREATE INDEX IF NOT EXISTS idx_class_bookings_member ON public.class_bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_gym ON public.attendance_logs(gym_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_member ON public.attendance_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_checkin ON public.attendance_logs(check_in_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gym ON public.payment_transactions(gym_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_member ON public.payment_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_date ON public.payment_transactions(payment_date);
CREATE INDEX IF NOT EXISTS idx_gym_equipment_gym ON public.gym_equipment(gym_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_trainer ON public.progress_notes(trainer_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_client ON public.progress_notes(client_id);
