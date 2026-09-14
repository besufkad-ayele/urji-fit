-- ==============================================================================
-- Urji Fit Seeds: Admin Account, Demo Account, Seed Workout Program
-- ==============================================================================

-- 1. Insert Initial Admin User
INSERT INTO public.users (id, phone, email, full_name, role, tier, subscription_status, onboarding_completed, disclaimer_acknowledged_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '+251900000000',
  'admin@urjifit.com',
  'Urji Admin',
  'admin',
  'premium',
  'active',
  true,
  now()
) ON CONFLICT (email) DO NOTHING;

-- 2. Insert Demo User (Bes)
INSERT INTO public.users (id, phone, email, full_name, role, tier, subscription_status, onboarding_completed, disclaimer_acknowledged_at, daily_calorie_target, daily_protein_target, daily_carb_target, daily_fat_target, daily_water_target_ml)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '+251912345678',
  'bes@urjifit.com',
  'Besufkad Ayele',
  'user',
  'premium',
  'active',
  true,
  now(),
  2200,
  160,
  220,
  65,
  3000
) ON CONFLICT (email) DO NOTHING;

-- 3. Insert Ready-to-Use 6-Digit OTP for Demo User: '123456'
INSERT INTO public.otps (user_id, code, expires_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '123456',
  now() + interval '30 days'
);

-- Also an OTP for Admin: '999999'
INSERT INTO public.otps (user_id, code, expires_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '999999',
  now() + interval '30 days'
);

-- 4. Seed 6-Day Workout Program (Global Templates)
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

-- 5. Seed some initial demo logs for Bes (weight history, meals, hydration, sleep)
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
