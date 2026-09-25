# AGENTS.md

## Project Structure

Two independent packages (no monorepo tooling, no root package.json):

- **`backend/`** — Express 4 API server (ESM), PostgreSQL via `pg`, JWT auth
- **`frontend/`** — React 19 + Vite 8 SPA, 

## Commands

### Backend (`backend/`)
```bash
npm run dev        # start dev server with --watch (port 5000)
npm run start      # production start
npm run migrate    # create tables + seed data (idempotent, safe to re-run)
```

### Frontend (`frontend/`)
```bash
npm run dev        # Vite dev server (port 5173)
npm run build      # production build
npm run lint       # ESLint (JSX files, ignores dist/)
npm run preview    # preview production build
```

## Setup

1. Copy `backend/.env.example` to `backend/.env` and fill in `DB_PASSWORD` and `JWT_SECRET`
2. Requires a running PostgreSQL instance with database `library_db` (or whatever `DB_NAME` is set to)
3. Run `npm run migrate` in `backend/` — this creates all tables and seeds membership plans, seats, and an admin user. Admin credentials are configured securely through environment variables and are not stored in this documentation.
4. Start both servers: backend on :5000, frontend on :5173

## Key Architecture Notes

- **API proxy**: Vite dev server proxies `/api` requests to `http://localhost:5000` (configured in `frontend/vite.config.js`). The frontend API client (`frontend/src/services/api.js`) uses relative `/api` paths — never hardcode `localhost:5000` in frontend code.
- **Auth flow**: JWT stored in `localStorage`, sent as `Bearer` token. Middleware: `authenticate` + `authorize(...roles)` in `backend/src/middleware/auth.js`.
- **Role-based routing**: Two protected route trees — `/student/*` and `/admin/*` — gated by `ProtectedRoute` component with role prop.
- **Migration system**: Custom script (`backend/src/db/migrate.js`), not a migration library. Uses `CREATE TABLE IF NOT EXISTS` — idempotent but not versioned. If you add tables, add them to the `migrations` array in this file.
- **File uploads**: Payment screenshots and QR codes are stored as **BYTEA in PostgreSQL** (multer `memoryStorage` — never written to disk). Legacy disk files in `backend/uploads/` are still served at `/uploads` and are imported into the DB on migrate.
- **No tests**: There are no test suites in either package. Verify changes with `npm run lint` + `npm run build` (frontend), `node --check` (backend files), `npm run migrate`, and manual API smoke tests.
- **No typecheck**: Frontend is plain JS with JSX; no TypeScript or typecheck script exists.
- **No CI/CD**: No GitHub Actions or pre-commit hooks configured.

## API Routes

All prefixed with `/api`:

| Prefix | Auth | Description |
|--------|------|-------------|
| `/auth` | public | login, register, getMe |
| `/student` | JWT + role=student | dashboard, seats, membership, **payment (multipart: UTR + screenshot, atomic)**, payment-history, profile, notifications, help, lost-found, fee-plans, book-seat, upload-screenshot |
| `/admin` | JWT + role=admin | dashboard, students, seats, payments (+ `GET /payments/:id/screenshot`), offline-booking, fee-plans, settings, notifications, help (`GET /help`, `PUT /help/:id`), lost-found, reports, renew-membership |
| `/settings` | public | get payment settings (QR code, UPI ID) + `GET /settings/timings` (4 active timing plans) |

## Frontend Routes

- `/` — public home
- `/login`, `/register` — public auth
- `/student/*` — student dashboard, seat-booking, membership, payment, payment-history, help, lost-found, notifications, profile
- `/admin/*` — admin dashboard, students, seats, memberships, payments, lost-found, notifications, help, reports, settings

## Database Schema (12 tables)

`users`, `rooms`, `seats`, `seat_layouts`, `fee_plans`, `memberships`, `bookings`, `payments`, `notifications`, `lost_found`, `help_requests`, `payment_settings`

### Seeded Data
- **Fee Plans (5)**: 24H ₹1500, 7AM-11PM ₹1200, 5AM-10AM ₹500, 10AM-6:30PM ₹1000, 7PM-12AM ₹500
- **Rooms (3)**: Room 1 (20 seats), Room 2 (19 seats), Room 3 (4 seats)
- **Seats (43)**: S-01 through S-43, with positions for U-shaped room layouts
- **Admin**: Credentials are set via `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables — not stored in code or documentation.

## Key Features

- **Timing-aware seat booking**: Overlap detection uses INTEGER minutes-from-midnight (avoids PostgreSQL TIME midnight edge cases). `is_24_hour BOOLEAN` flag for 24H plan. Conflict prevention at DB/transaction level using `SELECT FOR UPDATE`.
- **Seat sharing**: Max 2 members per seat if timing intervals don't overlap; 24H plan blocks entirely.
- **Payment flow**: `POST /student/payment` atomically creates membership (`pending`) + payment (`pending`, UTR + screenshot BYTEA) + booking (`pending`) + seat (`reserved`). Admin approve → payment completed / membership active / booking active / seat booked; reject → cancelled and seat released. QR code (admin-configurable), receiver name NISHANT SAHU.
- **Membership status**: Computed in SQL (`end_date < CURRENT_DATE` → `expired`) — frontend must render the API-provided status, never derive it from JS dates.
- **Help desk**: `help_requests` table; students submit/list own requests, admin replies (`admin_reply`) + sets status (`pending`/`in_progress`/`resolved`); replies create student notifications.
- **Lost & Found statuses**: `lost` → `found` → `returned` → `closed`; admin actions notify the reporter only on actual change.
- **Offline booking**: Admin can create Cash/UPI bookings with full student/seat/timing/amount/date/notes.
- **Payment settings**: Admin-only QR code URL, receiver name, UPI ID, note — served via `/api/settings`.
- **Dark navy/black UI** (#0a0e1a bg), neon blue accent (#3b82f6). Admin navbar has **no global search** (removed — page-level search inputs remain).

## Gotchas

- The `migrate.js` seed creates an admin user from environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). Credentials are not stored in source code.
- CORS is hardcoded to `http://localhost:5173` in `backend/src/server.js`. Update for deployment.
- Seat layout is seeded with fixed room assignments (Room 1: S-01–S-20, Room 2: S-21–S-39, Room 3: S-14/15/16/17). Changes to seat structure require editing the seed in `migrate.js`.
- Both packages use ESM (`"type": "module"`). Use `import`/`export`, not `require`.
- No Student ID field anywhere in the system.
- Receiver name for payments must always show as NISHANT SAHU.
- Room 3 seats are 14, 15, 16, 17 (NOT 18). Seat 18 belongs ONLY to Room 1.
- `bookings.status` includes `'pending'` (awaiting payment approval) alongside active/cancelled/completed; seat `reserved` usually means a pending payment holds it. Seat-conflict checks must consider `status IN ('active','pending')`.
- Never `SELECT p.*` from `payments` in list endpoints — `screenshot_data BYTEA` would bloat payloads. Use explicit columns + `(screenshot_data IS NOT NULL) AS has_screenshot`.
