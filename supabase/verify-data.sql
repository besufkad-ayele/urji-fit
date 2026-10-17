-- ==============================================================================
-- Verify that users and OTPs were created correctly
-- ==============================================================================

-- Check all users
SELECT id, phone, email, full_name, role 
FROM public.users 
ORDER BY role, full_name;

-- Check all OTPs
SELECT o.id, o.code, o.is_consumed, o.expires_at, u.full_name, u.phone, u.email, u.role
FROM public.otps o
JOIN public.users u ON o.user_id = u.id
ORDER BY u.role, u.full_name;

-- Check if OTPs are expired
SELECT 
  u.full_name,
  u.phone,
  o.code,
  o.is_consumed,
  o.expires_at,
  CASE 
    WHEN o.expires_at > NOW() THEN 'Valid'
    ELSE 'Expired'
  END as status
FROM public.otps o
JOIN public.users u ON o.user_id = u.id
ORDER BY u.role, u.full_name;
