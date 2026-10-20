# Ethiopian manual payment receipts

This web flow supports ETB payments sent directly to each gym by bank transfer or mobile money. It is not a payment gateway: members transfer outside Urji Fit, upload a JPG/PNG/WebP receipt screenshot, and an authorized gym owner, manager, or receptionist reviews it.

## Setup

1. Apply the migrations in order: [`supabase/migrations/202610200001_manual_payment_receipts.sql`](../supabase/migrations/202610200001_manual_payment_receipts.sql), [`supabase/migrations/202610200002_phase_one_member_management.sql`](../supabase/migrations/202610200002_phase_one_member_management.sql), then [`supabase/migrations/202610200003_phase_two_billing.sql`](../supabase/migrations/202610200003_phase_two_billing.sql). The billing migration adds invoice records and lines and links verified receipt payments to invoice balances; the earlier migration adds gym transfer instructions, review metadata, a duplicate-reference guard, a private `payment-receipts` Storage bucket, and removes legacy open policies on authentication and gym-business tables. Gym business data is accessed through server-side APIs.
2. Configure `SESSION_SECRET` in the deployment environment with a cryptographically random secret of at least 32 characters. Keep it server-side; do not prefix it with `NEXT_PUBLIC_`. For local development, add it to the ignored `.env.local` file. The OTP login endpoint refuses to create a session cookie if this setting is missing.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the deployment environment. Never expose the service-role key in browser code.
4. Sign in as a gym owner or an active gym manager/receptionist, open **Payments & receipts** in the gym dashboard, and save the bank account and/or mobile-money account members should use.
5. Sign in again after deployment so the browser receives the new signed session cookie. Then sign in as a member, open **Payments**, submit the amount and transfer method with a receipt screenshot, and have authorized staff verify or reject it.

Receipts are private, limited to 5 MB, checked against the declared image type, and only opened through a short-lived signed URL after server-side authorization. Do not mark a transfer as verified until it is confirmed against the bank or wallet statement.

Staff must confirm each receipt against the bank or wallet statement before approval. If the submitted payment is linked to an open invoice, approval applies the amount to its balance, rejects overpayment, and activates/renews the associated membership when the invoice is fully paid. Payments not linked to an invoice remain payment records and do not change membership status. This is manual transfer verification, not a payment gateway or automatic charge.

Renewal invoices and invoice follow-up tasks can be queued by scheduling `GET /api/cron/invoice-reminders` with `Authorization: Bearer <CRON_SECRET>`. Configure `CRON_SECRET` with a random secret of at least 32 characters. The endpoint only queues renewal invoices/reminder tasks; it does not charge members or deliver notifications. `auto_renew` is intentionally disabled.

## API contract

- `GET /api/payments`: members receive available gyms, their memberships, and payment history; authorized gym staff can list their gyms.
- `GET /api/payments?gymId=<id>`: authorized gym staff receive payment submissions for that location.
- `POST /api/payments` (`multipart/form-data`): `gymId`, optional `membershipId`, `amount` (ETB), `paymentMethod` (`bank_transfer` or `mobile_money`), optional `referenceNumber`, and `receipt` (JPG/PNG/WebP).
- `PATCH /api/payments/<id>`: authorized staff submit `{ "action": "approve" }` or `{ "action": "reject", "reason": "..." }`.
- `GET /api/payments/<id>/receipt`: returns the private receipt only to its member or authorized gym staff.
- `GET/PATCH /api/gyms/<gymId>/payment-settings`: read/update member-facing transfer instructions for authorized staff.

All payment routes require the signed, HttpOnly session cookie issued by OTP login. `SESSION_SECRET` must be the same across application instances and remain stable while sessions are active.
