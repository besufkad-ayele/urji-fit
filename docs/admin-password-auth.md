# Platform administrator password sign-in

Platform administrators can use email and password sign-in. Gym owners, trainers, and members continue to use their single-use OTPs.

## Set the first administrator password

1. Apply `supabase/migrations/202610200006_admin_password_auth.sql` to the production Supabase project and deploy the application.
2. Issue a fresh one-time OTP to your existing platform-admin account using the trusted admin flow or Supabase SQL.
3. Sign in on `/login` with the administrator email and OTP.
4. Open **Admin → Settings**, enter a password of at least 12 characters, confirm it, and select **Set admin password**.
5. Sign out and choose **Admin password** on `/login` to use email/password going forward.

The initial password can only be set from an authenticated admin session and only if no password has already been set for that account. Later changes require the current password. Passwords are stored as scrypt hashes, and five failed password attempts trigger a 15-minute lockout.

Do not use the seeded `admin@urjifit.com` demo account in production. OTP authentication and the existing demo-account production block remain unchanged.
