CREATE TABLE IF NOT EXISTS public.admin_password_credentials (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_password_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_password_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_password_credentials TO service_role;

CREATE OR REPLACE FUNCTION public.record_admin_password_failure(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.admin_password_credentials
  SET
    failed_attempts = CASE
      WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1
      ELSE failed_attempts + 1
    END,
    locked_until = CASE
      WHEN locked_until IS NOT NULL AND locked_until <= now() THEN NULL
      WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
      ELSE locked_until
    END,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_admin_password_failure(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_admin_password_failure(UUID) TO service_role;
