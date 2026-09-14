---
name: urji-fit
description: >-
  Architectural guidelines, domain rules, and technical runbook for Urji Fit —
  the personal fitness, nutrition, fasting, water, sleep, and habit planner.
  Use when developing, modifying, or testing features across the Next.js web/admin
  codebase (urji-fit) and the Flutter mobile application (urji-fit-app).
---

# Urji Fit Engineering & Architecture Skill

Urji Fit is an integrated personal fitness, nutrition, fasting, water, sleep, and habit planner.
It spans two codebases:
1. **Next.js Web Portal & Admin Dashboard** (`urji-fit`)
2. **Flutter Mobile Application** (`urji-fit-app`)
3. **Database**: Supabase PostgreSQL (`updmcynrapoaedcenlzk`)

---

## 1. Design System & Tokens

Every UI surface must adhere strictly to these visual tokens:

| Token | Value | Purpose |
|---|---|---|
| **Canvas Background** | `#F3EFE5` | Warm natural cream background |
| **Accent Shade** | `#F2F7D9` | Soft pale lime-sage cream highlight |
| **Primary / Action** | `#0B3D2E` | Deep rich pine-forest green for buttons, active tabs, primary icons |
| **Primary Hover / Focus** | `#135440` | Interactive states |
| **Primary Text** | `#14201A` | Deep charcoal spruce for high-contrast typography |
| **Muted Text / Details**| `rgb(90, 102, 96)` (`#5A6660`) | Secondary labels, timestamps, metadata |
| **Overload / Alert Accent** | `#C1502E` | Iron rust for progressive overload badges, plate highlights |
| **Display Font** | `"Instrument Serif", Georgia, serif` | Headings, large numbers, hero titles |
| **Body Font** | `Inter, -apple-system, sans-serif` | Inputs, data tables, exercise lists, body text |

---

## 2. Authentication & Device-Lock Model

- **No Public Self-Service Signup**: Accounts are created exclusively via the **Admin Dashboard** (`/admin`).
- **Single-Use OTP**: When an admin registers a user or grants a device switch, a 6-digit numeric OTP is issued (valid for 24h).
- **Single-Device Enforcement**:
  - When the user logs in on Web or Mobile with their phone/email and OTP:
    1. The backend verifies the OTP and marks `is_consumed = true`.
    2. The client provides a unique `device_id` (UUID generated on device/browser).
    3. The `users.current_device_id` is updated to this device.
    4. Any previous active session on a different device is invalidated.
  - Device switch is admin-mediated: the admin resets the device or issues a fresh OTP from the Admin Dashboard.

---

## 3. Core Domain Engines & Integration Rules

### 3.1 Progressive Overload Engine
- Each exercise tracks logged history: `sets × reps × weight_kg`.
- **Weight Increase Rule**: If a user hits the top of their target rep range for all sets, **2 sessions in a row** $\rightarrow$ prompt a weight increase ($+2.5\%$ to $+5\%$, minimum $+1\text{ kg}$).
- **Deload Rule**: If a user misses their target rep range **2 sessions in a row** $\rightarrow$ suggest a deload (reduce weight $\approx 10\%$) or holding steady.
- Avoid nagging: Store `last_suggested_change` in `progression_suggestions` and only trigger when state transitions.

### 3.2 Fasting + Nutrition Integration
- Fasting timer and food logging share real-time state.
- If a user logs a food entry while a fasting window is currently active (`status = 'active'`):
  - The UI presents a prompt: *"Logging food will conclude your current fasting window. Complete fast now?"*
  - On confirmation, the fasting window is automatically marked `completed` and linked to `broken_by_food_log_id`.
- The Today dashboard displays both remaining calories and countdown to next eating window.

### 3.3 Sleep & Generic Wind-Down Discipline
- User sets target bedtime (e.g., `23:00`) and wake time (e.g., `07:00`).
- The system schedules **one generic notification / reminder banner** $N$ minutes before bedtime:
  > *"Wind-down time — put the phone down for better sleep."*
- Independent native alarm integration is provided for wake time.

### 3.4 Mandatory Monthly Check-in & Disclaimer
- First-time user flow requires mandatory acknowledgement of the health and body-metric estimate disclaimer.
- Ad-hoc weight and waist logging can occur anytime.
- At least one entry per calendar month must be flagged `is_monthly_checkin = true`. If missing for the current month, a dashboard reminder banner prompts the user.

---

## 4. Supabase Database Schema

Key tables:
- `users`: Profile, targets, current active `device_id`, subscription status, disclaimer timestamp.
- `otps`: 6-digit single-use codes linked to user and expiry.
- `workout_templates` & `workout_exercises`: Weekly splits (Push, Pull, Legs, etc.) with exercise target sets/reps and tutorial video URLs.
- `workout_sessions` & `exercise_sets`: Performed workouts, weights, reps, RPE, fatigue score.
- `progression_suggestions`: Automated progressive overload engine outputs.
- `food_logs`: Meals, calories, macros (protein, carbs, fats).
- `fasting_windows`: Fasting presets (16:8, 18:6, 20:4, custom), start/end times.
- `water_logs`: Daily fluid intake.
- `sleep_logs`: Sleep duration, quality, sleep debt.
- `body_metrics`: Weight, waist measurements, monthly check-in flag.

---

## 5. Development Workflows

### Next.js Web (`urji-fit`)
```bash
# In d:\02_Work_and_Engineering\01_Development\Projects\Personal\urji-fit
npm install
npm run dev    # runs on port 3000
npm run build  # verify production build
```

### Flutter Mobile (`urji-fit-app`)
```bash
# In d:\02_Work_and_Engineering\01_Development\Projects\Personal\urji-fit-app
flutter pub get
flutter run    # launches on attached device/emulator/chrome
flutter analyze # verify linting and types
```
