# Gym membership operations

The gym-owner operations screen is available at `/gym-owner/operations`. Phase 1 includes membership-plan catalog management, member lookup/enrollment and record editing, household grouping, lead-to-member conversion, waiver publication/signatures, and a gym audit timeline. Membership freeze/resume/cancel/transfer/plan-change APIs remain available. Member-owned profile fields are available through `/profile`.

## Database setup

For a new database, apply `supabase/schema.sql` first, then apply migrations in filename order. For an existing installation based on the original schema, apply `supabase/migrations/202610200001_manual_payment_receipts.sql`, `supabase/migrations/202610200002_phase_one_member_management.sql`, `supabase/migrations/202610200003_phase_two_billing.sql`, `supabase/migrations/202610200004_phase_three_coaching.sql`, and `supabase/migrations/202610200005_phase_four_analytics_automation.sql` in filename order before deploying the latest endpoints. The migrations install payment receipt storage, member management, billing/POS/reminder/class-rescheduling, trainer-program/workout logging, and reports/commission/announcement/notification schema and RPCs. Do not replace a live database schema with the baseline file.

The API uses the server-side Supabase service role and the signed, device-bound session cookie. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only and configure `SESSION_SECRET` with at least 32 characters.

## Class reservations

Members with an active membership can browse `/classes` and reserve the next weekly occurrence of a zero-price class. Capacity is serialized by a Postgres row lock, full classes place new bookings into a FIFO waitlist, and canceling a booked seat promotes the next waitlisted member. Members can reschedule their own booking within the supported future occurrences. Paid classes remain visible but cannot be reserved in-app because payment verification is not yet linked to class bookings; members must arrange those bookings with the gym.

## Billing and inventory

The Phase 2 migration creates invoices for new memberships, supports manual invoices and promo codes, allows unpaid membership and renewal invoices to be consolidated for household billing, and links staff-approved ETB receipt payments to invoice balances. Payment collection is still a manual Ethiopia bank/mobile-money transfer workflow; there is no integrated gateway, automatic charge, or automatic retry. Household renewal invoice lines preserve the membership period so verified settlement can activate membership and apply the correct renewal end date.

The owner dashboard at `/gym-owner/payments` manages invoices, promos, and staff follow-up reminders. The cash-only POS and product-stock controls are at `/gym-owner/pos`; POS sales are recorded separately from member payment transactions. Applying `supabase/migrations/202610200003_phase_two_billing.sql` is required before these screens and endpoints can work.

## Trainer and member coaching

Members can see their gym membership, upcoming class bookings, check-in/check-out, and recent attendance at `/gym`; class browsing and booking changes are available at `/classes`. App check-in records a visit only and does not grant physical door access. Trainers can review recurring classes and their next-four-week rosters, and mark a reservation attended or no-show at `/trainer/schedule`; weekly one-to-one client commitments remain in the coach dashboard.

Trainers with an active trainer/head-trainer staff record and an active client assignment can create and assign workout plans at `/trainer/programs`, including set/rep targets, demo video links, and general nutrition guidance. Members with an active membership can view those plans, record set-by-set weight/reps/RPE, review coached workout history, and message their active trainer at `/coaching`. Trainers can review client training logs in the program workspace and message clients at `/trainer/messages`; existing trainer progress notes remain available from `/trainer`.

Apply `supabase/migrations/202610200004_phase_three_coaching.sql` before using these screens. Workout writes are transactional and bound to the signed-in member and active assignment. Nutrition guidance is general coaching information, not a prescribed medical diet. Messaging is text-only and limited to active trainer-client relationships; push delivery, attachments, video calls, wearable sync, and offline messaging are not included.

To queue upcoming-renewal invoices and invoice reminders, configure `CRON_SECRET` in the deployment environment with a random secret of at least 32 characters and schedule an authorized `GET /api/cron/invoice-reminders` request. This job queues renewal invoices and staff follow-up tasks only: it does not charge members or send email, SMS, WhatsApp, or push messages. `auto_renew` is deliberately disabled until a payment gateway and explicit member authorization are implemented.

## Phase 4 reports and engagement

Gym owners and managers can open `/gym-owner/reports` for date-bounded reporting (up to 366 days), including active/new/canceled memberships, paid ETB collections, cash POS totals, issued/outstanding invoices, attendance trends, recurring-class capacity utilization, trainer attendance, failed payments, near-expiry members, and members without a visit in 14 days. CSV exports are available for payments, invoices, memberships, attendance, trainer attendance, commission records, inventory, and POS sales; exports require a signed owner/manager session, protect spreadsheet formula cells, and cap each export at 10,000 rows except attendance/trainer attendance (20,000). The report endpoint caps membership, payment, POS, and cancellation-audit reads at 10,000, invoice reads at 20,000, attendance and bookings at 20,000, active members for retention at 5,000, and classes at 1,000; watchlist display is capped at 100 members. The class utilization denominator is scheduled recurring-class capacity for active recurring classes; no-shows do not count as attended. Revenue is reported in ETB and separates payment transactions from cash POS totals; invoices are receivables, not collected revenue. MRR is not reported because recurring auto-charge is not enabled.

Trainer commission is manager-entered per attended class booking, as selected for this deployment. The commission ledger and trainer earnings screen record the ETB amount and whether management marked it paid. This ledger does not calculate a percentage, verify a bank transfer, or move funds. Commission creation and payout status changes are included in the gym audit log.

Managers can publish announcements to active member in-app inboxes. The daily `GET /api/cron/gym-automations` job queues deduplicated in-app notices for memberships expiring within seven days and active members without attendance during the previous 14 days. Schedule both this endpoint and the invoice reminder endpoint with `Authorization: Bearer <CRON_SECRET>`; never expose that secret in a browser or mobile client. The inbox and announcement screens do not send external email, SMS, WhatsApp, or push messages. Those providers require a separately selected integration, account credentials, delivery-consent rules, and provider-specific testing. Referral attribution, wearable/accounting/hardware integrations, and external campaign delivery are not included.

## Current behavior and boundaries

- Plan changes immediately replace the membership type, listed ETB price, and remaining session allowance; duration is reset from today when the selected plan defines `duration_days`. There is no automatic proration or payment capture. Collect any required price difference using the manual Ethiopia receipt workflow.
- Freeze suspends access and records `frozen_at`; resume restores active status and extends a dated membership by the full elapsed freeze days.
- Member accounts are created only in the Admin dashboard. Gym staff can match existing accounts by exact phone or email and enroll them; enrollment and lead conversion do not collect or verify payment.
- The owner dashboard links to member enrollment and private member-record editing in Gym Operations. Its Staff & Trainers screen can look up admin-created accounts, add team assignments, edit pay/status details, and terminate assignments without removing history. Trainer assignments require a trainer-role account.
- The owner Classes screen can create and edit recurring schedule entries and deactivate/reactivate classes; deactivation preserves booking history. The Attendance screen records staff-assisted open-gym check-in/check-out for members with active memberships and lists today's visits. This is an attendance log only, not physical door access control.
- Household invoice consolidation is available for unpaid membership and renewal invoices. Review pending receipts before consolidating; consolidation voids the included individual invoices and creates a single payable household invoice. Only the household's primary payer can see/submit that invoice. The migration must be applied before use.
- Member photo editing stores an HTTP(S) URL; managed image uploads are not implemented.
- Waiver signing stores the typed name, server timestamp, waiver version/content snapshot, and SHA-256 digest. This electronic acknowledgement is not legal advice or a guarantee of enforceability; have waiver text reviewed by qualified local counsel.
- Profile medical notes are visible to authorized gym owners/managers. The member API only lets members edit their own profile.
- Audit logging records Phase 1 administrative and member profile changes. Audit records are visible to gym owners/managers. Existing data changes from before this migration are not backfilled.
- Renewal invoices and follow-up tasks can be queued by the cron endpoint, but billing is not recurring and failed-payment retries/dunning delivery are not automated. Verify receipts against the bank or wallet statement before approval; linked invoice settlement activates or renews the associated membership.
