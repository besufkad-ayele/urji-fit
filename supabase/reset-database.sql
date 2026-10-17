-- ==============================================================================
-- COMPLETE DATABASE RESET - Run this to start completely fresh
-- ==============================================================================

-- Step 1: Drop all tables (in correct order to avoid foreign key constraints)
DROP TABLE IF EXISTS public.progress_notes CASCADE;
DROP TABLE IF EXISTS public.gym_equipment CASCADE;
DROP TABLE IF EXISTS public.payment_transactions CASCADE;
DROP TABLE IF EXISTS public.attendance_logs CASCADE;
DROP TABLE IF EXISTS public.class_bookings CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.trainer_assignments CASCADE;
DROP TABLE IF EXISTS public.gym_memberships CASCADE;
DROP TABLE IF EXISTS public.gym_staff CASCADE;
DROP TABLE IF EXISTS public.gyms CASCADE;
DROP TABLE IF EXISTS public.body_metrics CASCADE;
DROP TABLE IF EXISTS public.sleep_logs CASCADE;
DROP TABLE IF EXISTS public.water_logs CASCADE;
DROP TABLE IF EXISTS public.fasting_windows CASCADE;
DROP TABLE IF EXISTS public.food_logs CASCADE;
DROP TABLE IF EXISTS public.progression_suggestions CASCADE;
DROP TABLE IF EXISTS public.exercise_sets CASCADE;
DROP TABLE IF EXISTS public.workout_sessions CASCADE;
DROP TABLE IF EXISTS public.workout_exercises CASCADE;
DROP TABLE IF EXISTS public.workout_templates CASCADE;
DROP TABLE IF EXISTS public.otps CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Step 2: Verify all tables are gone
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename NOT LIKE 'pg_%'
AND tablename NOT LIKE 'sql_%';

-- You should see an empty result
-- Now run schema.sql, then seed.sql
