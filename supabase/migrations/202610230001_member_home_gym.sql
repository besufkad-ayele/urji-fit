ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS home_gym_id UUID REFERENCES public.gyms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_home_gym
  ON public.users(home_gym_id);
