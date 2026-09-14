export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string;
  role: 'user' | 'admin';
  tier: 'free' | 'premium';
  subscription_status: 'active' | 'expired' | 'canceled' | 'trial';
  subscription_expires_at: string | null;
  current_device_id: string | null;
  device_name: string | null;
  last_active_at: string;
  disclaimer_acknowledged_at: string | null;
  onboarding_completed: boolean;
  daily_calorie_target: number;
  daily_protein_target: number;
  daily_carb_target: number;
  daily_fat_target: number;
  daily_water_target_ml: number;
  target_bedtime: string;
  target_waketime: string;
  wind_down_offset_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface OTP {
  id: string;
  user_id: string;
  code: string;
  device_id: string | null;
  is_consumed: boolean;
  consumed_at: string | null;
  expires_at: string;
  created_at: string;
  user?: User;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string | null;
  name: string;
  tag: string;
  days: number[]; // 1=Mon, 2=Tue, ..., 7=Sun or 0=Sun
  cardio: string | null;
  created_at: string;
  updated_at: string;
  workout_exercises?: WorkoutExercise[];
}

export interface WorkoutExercise {
  id: string;
  workout_template_id: string;
  name: string;
  spec: string;
  target_sets: number;
  target_reps_min: number;
  target_reps_max: number;
  video_url: string | null;
  music_url: string | null;
  order_index: number;
  created_at: string;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  workout_template_id: string | null;
  name: string;
  session_date: string;
  started_at: string;
  completed_at: string | null;
  fatigue_rating: number | null;
  notes: string | null;
  created_at: string;
  exercise_sets?: ExerciseSet[];
}

export interface ExerciseSet {
  id?: string;
  session_id: string;
  exercise_name: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe?: number | null;
  is_completed: boolean;
  created_at?: string;
}

export interface ProgressionSuggestion {
  id: string;
  user_id: string;
  exercise_name: string;
  previous_weight_kg: number;
  suggested_weight_kg: number;
  reason: string;
  status: 'pending' | 'accepted' | 'dismissed';
  created_at: string;
}

export interface FoodLog {
  id: string;
  user_id: string;
  log_date: string;
  logged_at: string;
  meal_type: 'pre-workout' | 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other';
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion_desc: string | null;
  created_at: string;
}

export interface FastingWindow {
  id: string;
  user_id: string;
  preset: string;
  target_hours: number;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'completed' | 'canceled';
  broken_by_food_log_id: string | null;
  created_at: string;
}

export interface WaterLog {
  id: string;
  user_id: string;
  log_date: string;
  logged_at: string;
  amount_ml: number;
  created_at: string;
}

export interface SleepLog {
  id: string;
  user_id: string;
  log_date: string;
  bedtime: string;
  wake_time: string;
  duration_minutes: number;
  quality_rating: number | null;
  source: 'manual' | 'healthkit' | 'google_fit';
  created_at: string;
}

export interface BodyMetric {
  id: string;
  user_id: string;
  entry_date: string;
  logged_at: string;
  weight_kg: number;
  waist_cm: number | null;
  body_fat_pct: number | null;
  is_monthly_checkin: boolean;
  created_at: string;
}
