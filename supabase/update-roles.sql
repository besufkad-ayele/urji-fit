-- ==============================================================================
-- Update old 'user' role to 'member' role
-- Run this if you have existing data with old role values
-- ==============================================================================

-- Update all users with role 'user' to 'member'
UPDATE public.users 
SET role = 'member' 
WHERE role = 'user';

-- Verify the update
SELECT id, full_name, email, role 
FROM public.users 
ORDER BY role, full_name;
