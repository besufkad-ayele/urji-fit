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
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
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
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- Allow read/write for service_role (bypasses RLS) and create permissive policy for users
-- Note: Service role has full access by default. We add policies for authenticated user access.
CREATE POLICY "Allow public read of templates" ON public.workout_templates FOR SELECT USING (user_id IS NULL OR true);
CREATE POLICY "Allow public read of exercises" ON public.workout_exercises FOR SELECT USING (true);
CREATE POLICY "Allow all actions on users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow all actions on otps" ON public.otps FOR ALL USING (true);
CREATE POLICY "Allow all actions on workout_templates" ON public.workout_templates FOR ALL USING (true);
CREATE POLICY "Allow all actions on workout_exercises" ON public.workout_exercises FOR ALL USING (true);
CREATE POLICY "Allow all actions on workout_sessions" ON public.workout_sessions FOR ALL USING (true);
CREATE POLICY "Allow all actions on exercise_sets" ON public.exercise_sets FOR ALL USING (true);
CREATE POLICY "Allow all actions on progression_suggestions" ON public.progression_suggestions FOR ALL USING (true);
CREATE POLICY "Allow all actions on food_logs" ON public.food_logs FOR ALL USING (true);
CREATE POLICY "Allow all actions on fasting_windows" ON public.fasting_windows FOR ALL USING (true);
CREATE POLICY "Allow all actions on water_logs" ON public.water_logs FOR ALL USING (true);
CREATE POLICY "Allow all actions on sleep_logs" ON public.sleep_logs FOR ALL USING (true);
CREATE POLICY "Allow all actions on body_metrics" ON public.body_metrics FOR ALL USING (true);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_otps_code_user ON public.otps(code, user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON public.workout_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_food_logs_user_date ON public.food_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON public.water_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_date ON public.sleep_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_body_metrics_user_date ON public.body_metrics(user_id, entry_date);
