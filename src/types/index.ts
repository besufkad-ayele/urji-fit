export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string;
  role: 'member' | 'trainer' | 'gym_owner' | 'admin' | 'platform_admin';
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
  avatar_url: string | null;
  bio: string | null;
  certifications: string[] | null;
  specializations: string[] | null;
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

// ==============================================================================
// GYM MANAGEMENT TYPES
// ==============================================================================

export interface Gym {
  id: string;
  name: string;
  owner_id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  operating_hours: Record<string, string> | null;
  amenities: string[] | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  mobile_money_provider?: string | null;
  mobile_money_account?: string | null;
  payment_instructions?: string | null;
  capacity: number;
  monthly_revenue: number;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
  owner?: User;
}

export interface GymStaff {
  id: string;
  gym_id: string;
  user_id: string;
  position: 'trainer' | 'head_trainer' | 'receptionist' | 'manager' | 'maintenance';
  hire_date: string;
  hourly_rate: number | null;
  salary: number | null;
  commission_rate: number | null;
  status: 'active' | 'on_leave' | 'terminated';
  notes: string | null;
  created_at: string;
  updated_at: string;
  user?: User;
  gym?: Gym;
}

export interface GymMembership {
  id: string;
  gym_id: string;
  member_id: string;
  membership_type:
    | 'monthly'
    | 'quarterly'
    | 'annual'
    | 'day_pass'
    | 'family'
    | 'corporate'
    | 'student'
    | 'couple'
    | 'pay_per_visit'
    | 'class_pack';
  price: number;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'expired' | 'suspended' | 'canceled';
  auto_renew: boolean;
  sessions_remaining: number | null;
  plan_id?: string | null;
  frozen_at?: string | null;
  pending_plan_id?: string | null;
  household_id?: string | null;
  created_at: string;
  updated_at: string;
  member?: User;
  gym?: Gym;
}

export interface TrainerAssignment {
  id: string;
  gym_id: string;
  trainer_id: string;
  client_id: string;
  assignment_type: 'personal_training' | 'group_training' | 'nutrition_coaching';
  sessions_per_week: number;
  session_duration_minutes: number;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'completed' | 'paused' | 'canceled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  trainer?: User;
  client?: User;
  gym?: Gym;
}

export interface Class {
  id: string;
  gym_id: string;
  trainer_id: string | null;
  name: string;
  description: string | null;
  class_type: 'yoga' | 'pilates' | 'spin' | 'hiit' | 'crossfit' | 'boxing' | 'zumba' | 'strength' | 'cardio' | 'flexibility' | 'other';
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  price: number;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels' | null;
  status: 'active' | 'canceled' | 'full';
  created_at: string;
  updated_at: string;
  trainer?: User;
  gym?: Gym;
  bookings?: ClassBooking[];
}

export interface ClassBooking {
  id: string;
  class_id: string;
  member_id: string;
  booking_date: string;
  status: 'booked' | 'waitlisted' | 'attended' | 'no_show' | 'canceled';
  checked_in_at: string | null;
  notes: string | null;
  created_at: string;
  member?: User;
  class?: Class;
}

export interface AttendanceLog {
  id: string;
  gym_id: string;
  member_id: string;
  check_in_at: string;
  check_out_at: string | null;
  attendance_type: 'open_gym' | 'class' | 'personal_training';
  class_booking_id: string | null;
  notes: string | null;
  created_at: string;
  member?: User;
  gym?: Gym;
}

export interface PaymentTransaction {
  id: string;
  gym_id: string;
  member_id: string;
  membership_id: string | null;
  amount: number;
  payment_method: 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'other';
  transaction_type: 'membership_fee' | 'class_pack' | 'personal_training' | 'day_pass' | 'merchandise' | 'other';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_date: string;
  notes: string | null;
  currency: 'ETB';
  reference_number: string | null;
  receipt_path: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  member?: User;
  gym?: Gym;
}

export interface GymEquipment {
  id: string;
  gym_id: string;
  name: string;
  equipment_type: 'cardio' | 'strength' | 'free_weights' | 'functional' | 'accessories' | 'other';
  brand: string | null;
  model: string | null;
  quantity: number;
  purchase_date: string | null;
  purchase_price: number | null;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'broken';
  maintenance_schedule: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  status: 'active' | 'maintenance' | 'retired';
  notes: string | null;
  created_at: string;
  updated_at: string;
  gym?: Gym;
}

export interface ProgressNote {
  id: string;
  trainer_id: string;
  client_id: string;
  gym_id: string | null;
  note_date: string;
  note_type: 'assessment' | 'progress' | 'injury' | 'goal_update' | 'general' | null;
  content: string;
  measurements: Record<string, number> | null;
  photos: string[] | null;
  is_private: boolean;
  created_at: string;
  trainer?: User;
  client?: User;
  gym?: Gym;
}
