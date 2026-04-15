# Authenticated Smoke Checklist

Use this checklist after schema changes, RBAC changes, route changes, or deployment changes.

## Preconditions

- The database schema from [supabase/schema.sql](/home/scott/repos/sgf-app/supabase/schema.sql) is applied.
- At least one coach user exists in `clients` with `role = 'coach'`.
- At least two client users exist in `clients` with `role = 'client'`.
- One client starts unassigned: `designated_coach_id is null`.
- One client starts assigned to the coach under test.
- At least one assigned client has:
  - a completed onboarding profile in `fitness_profiles`
  - an available package in `client_packages`
  - optional historical `sessions` rows for coach session actions
- App is running locally or in a deployed environment.

## Harness

The scripted smoke harness uses the emails in this file plus password environment variables.

Required environment variables:

- `SMOKE_COACH_PASSWORD`
- `SMOKE_ASSIGNED_CLIENT_PASSWORD`
- `SMOKE_UNASSIGNED_CLIENT_PASSWORD`

Optional environment variables:

- `SMOKE_BASE_URL`
  - Defaults to `http://127.0.0.1:3000`
- `SMOKE_ENABLE_BOOKING=1`
  - Enables real session booking and package consumption checks
- `SMOKE_ENABLE_CHECKOUT=1`
  - Enables Stripe checkout session creation checks

Run the harness with:

```bash
SMOKE_COACH_PASSWORD='...' \
SMOKE_ASSIGNED_CLIENT_PASSWORD='...' \
SMOKE_UNASSIGNED_CLIENT_PASSWORD='...' \
npm run smoke:auth
```

## Test Accounts

Record the accounts used for the pass.

- Coach email: 5c077.60rd0n@gmail.com
- Assigned client email: da_mona_lisa@msn.com
- Unassigned client email: connor.gordon2002@gmail.com
- Extra coach email, if available:

## Smoke Pass Order

Run the pass in this order so failures are easier to isolate:

1. Unauthenticated route protection
2. Client authenticated flow
3. Coach authenticated flow
4. Cross-role and cross-assignment negative cases
5. Messaging flow
6. Booking and package flow

## 1. Unauthenticated Protection

### Routes

- Open `/dashboard`.
  - Expected: redirect to `/auth/login`.
- Open `/dashboard/messages`.
  - Expected: redirect to `/auth/login`.
- Open `/dashboard/fitness`.
  - Expected: redirect to `/auth/login`.
- Open `/coach`.
  - Expected: redirect to `/auth/login`.

### APIs

- Request `GET /api/messages` with no session.
  - Expected: `401`.
- Request `GET /api/sessions/available` with no session.
  - Expected: `401`.
- Request `PATCH /api/coach/clients/:id/assignment` with no session.
  - Expected: `401`.

## 2. Client Authenticated Flow

Log in as the assigned client.

### Route Access

- Open `/dashboard`.
  - Expected: loads successfully.
- Open `/dashboard/messages`.
  - Expected: loads successfully.
- Open `/dashboard/fitness`.
  - Expected: loads if onboarding is complete, otherwise redirects to `/dashboard/onboarding`.
- Open `/coach`.
  - Expected: redirect away from coach area.

### Dashboard

- Confirm the dashboard shows session/package information.
- Confirm the dashboard includes a trainer messaging entry point.

### Fitness

- Generate a workout plan.
  - Expected: success response and plan visible.
- Save a workout log.
  - Expected: success response and log visible.
- Save a set log.
  - Expected: success response and set visible.

### Messaging

- Send a message to the designated coach.
  - Expected: success response and message appears in thread.

### Booking and Checkout

- Load available session slots.
  - Expected: list returns successfully.
- Book a valid session using a package with remaining sessions.
  - Expected: success and package/session state updates.
- Start package checkout.
  - Expected: checkout session is created or expected Stripe configuration error is shown if Stripe is intentionally not configured in the environment.

## 3. Coach Authenticated Flow

Log out, then log in as the coach.

### Route Access

- Open `/coach`.
  - Expected: loads successfully.
- Open `/dashboard`.
  - Expected: redirect to `/coach`.
- Open `/coach/clients/:assignedClientId`.
  - Expected: loads successfully.
- Open `/coach/clients/:assignedClientId/messages`.
  - Expected: loads successfully.

### Assignment Management

- In the unassigned clients section, assign the unassigned client to the current coach.
  - Expected: client moves from unassigned to assigned.
- Release that same client.
  - Expected: client moves back to unassigned.

### Assigned Client Operations

- Open an assigned client detail page.
  - Expected: page renders package and session data.
- Generate a workout plan for the assigned client.
  - Expected: success response.
- Update a scheduled session status or notes.
  - Expected: success response and refreshed session state.
- Send a coach message to the assigned client.
  - Expected: success response and message appears in thread.

## 4. Negative Authorization Cases

These checks verify least-privilege behavior.

### Client Negative Cases

Logged in as a client:

- Open `/coach`.
  - Expected: redirect away from coach area.
- Attempt `PATCH /api/coach/clients/:id/assignment`.
  - Expected: `403` or role-based rejection.
- Attempt `POST /api/coach/workouts/generate`.
  - Expected: `403`.
- Attempt `PATCH /api/coach/sessions/:id`.
  - Expected: `403`.

### Coach Negative Cases

Logged in as a coach:

- Attempt to open `/dashboard/messages`.
  - Expected: redirect to `/coach`.
- Attempt to book a client session from client APIs such as `POST /api/sessions/book`.
  - Expected: `403`.
- Attempt to call client workout logging endpoints.
  - Expected: `403`.

### Cross-Assignment Negative Cases

Logged in as the coach under test:

- Open `/coach/clients/:unassignedClientId` before assigning the client.
  - Expected: not found or denied.
- Open `/coach/clients/:otherCoachClientId` if another coach/client pairing exists.
  - Expected: not found or denied.
- Request coach messaging thread for an unassigned client using `GET /api/messages?clientId=:id`.
  - Expected: `403`.
- Request coach workout generation for an unassigned client.
  - Expected: `403`.

## 5. Messaging End-to-End

Use one assigned client and one coach.

1. Client sends a message.
   - Expected: coach can read it on refresh.
2. Coach replies.
   - Expected: client can read it on refresh.
3. Attempt messaging as a client with no designated coach.
   - Expected: validation error explaining no designated trainer is assigned.

## 6. Booking and Package Integrity

Use a client with a package that has remaining sessions.

1. Record starting `sessions_remaining`.
2. Book a session.
   - Expected: session row created and package decremented once.
3. Attempt invalid or duplicate booking behavior if supported by the UI/API.
   - Expected: rejected cleanly.
4. If coach marks the session complete or no-show, verify the session state updates without corrupting package counts.

## 7. Database Verification

After the UI/API pass, verify persisted state directly.

- `clients.designated_coach_id` changes only for the intended client.
- `coach_client_messages` rows contain the expected `client_id`, `coach_id`, and `sender_id`.
- `workout_plans.user_id` matches the intended client for both self-generated and coach-generated plans.
- `sessions.client_id` and `client_packages.client_id` remain consistent.
- No unauthorized rows were created for other users.

## Exit Criteria

The smoke pass is complete only if all of the following are true:

- Public routes load.
- Protected routes redirect correctly when unauthenticated.
- Client-only operations work as client and fail as coach.
- Coach-only operations work for assigned clients and fail otherwise.
- Messaging works bidirectionally for assigned coach/client pairs.
- Booking and package state remain internally consistent.
- No unexpected authorization bypass is observed.