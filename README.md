# Wedding Memories

Production web application for **Wedding Invitations & Live Guest Updates** built with **Next.js 14 (App Router)**, **Prisma ORM**, **SQLite / PostgreSQL**, and **Tailwind CSS**.

## Setup & Running

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Push database schema:**
   ```bash
   npm run db:push
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Production build:**
   ```bash
   npm run build
   npm start
   ```

## Database Schema (`prisma/schema.prisma`)

- `User` — Host and Guest user accounts with verified email/phone and onboarding state.
- `Session` — SHA-256 hashed server-side authentication sessions with expiration.
- `OtpVerification` — HMAC-SHA256 hashed 6-digit email/phone OTP codes with expiration and brute-force attempt limits.
- `Wedding` — Wedding events owned by a host with unique invitation slug (`/invite/[slug]`).
- `Guest` — Invited guests with unique `inviteToken`, honest delivery status (`not_shared`, `link_shared`, `opened`, `responded`), RSVP status (`pending`, `yes`, `no`, `maybe`), linked user account (`linkedUserId`), and duplicate/conflict resolution fields.
- `EventUpdate` — Host-published text updates with category, pinning, and timestamps.
- `EventMembership` — Server-enforced membership linking verified users (`host` or `guest`) to weddings.
- `AnalyticsEvent` — Privacy-safe funnel telemetry stripped of raw address books, tokens, and PII.
