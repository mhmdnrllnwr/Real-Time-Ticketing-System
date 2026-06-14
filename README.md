# Cinema Ticketing System — Real-Time

Real-time seat reservation system demonstrating RTOS concepts (mutex, deadlock prevention, timeout, event flag) with clean OOAD architecture.

## Stack

Node.js · Express 5 · Socket.IO 4 · Vanilla JS

## Quick Start

```bash
npm install
node server.js
```

Open http://localhost:3000

## Pages

| Page | URL | Description |
|------|-----|-------------|
| User | `/` | Seat booking — login, lock, pay |
| Admin | `/admin` | Dashboard — view state, reset seats, toggle force-fail |
| Admin password | — | `admin123` |

## Architecture

```
Ticketing_System/
├── server.js                         Entry point
├── public/
│   ├── user.html                     Seat booking UI
│   └── admin.html                    Admin dashboard
├── src/
│   ├── models/
│   │   ├── Seat.js                   State machine (AVAILABLE→LOCKED→BOOKED)
│   │   └── Booking.js                Immutable booking record
│   ├── managers/
│   │   ├── MutexManager.js           RTOS mutex (acquire/release/forceRelease)
│   │   ├── SeatManager.js            Seat CRUD + lock orchestration
│   │   ├── BookingManager.js         Core booking flow (CFG-ready 30-50 LOC)
│   │   ├── PaymentProcessor.js       Mock payment + force-fail toggle
│   │   └── TimeoutWatcher.js         Event flag — 5-min auto-release
│   ├── auth/
│   │   └── SessionManager.js         Username ↔ socket mapping
│   ├── transport/
│   │   └── socketHandler.js          Socket.IO event routing
│   └── utils/
│       ├── constants.js              Config, enums, deadlines
│       ├── Logger.js                 <250ms soft real-time proof
│       └── Validator.js              Defensive input validation
└── docs/
    ├── core_concept.md               Assignment requirements
    └── 2026-06-14-cinema-ticketing-realtime-design.md
```

## Booking Flow

```
Login → Click seat → Mutex lock (5-min timer)
  → Pay → Confirm booking
       → Payment fails? Rollback seat to AVAILABLE
       → Timer expires? Auto-release seat
```

## Real-Time Concepts

| Concept | Implementation |
|---------|---------------|
| Mutex | `MutexManager` — test-and-set, owner-only release |
| Deadlock prevention | Single-seat-per-user, release-before-acquire |
| Timeout / Event flag | `TimeoutWatcher` — 5-min auto-release + broadcast |
| High cohesion | Each class one responsibility (11 classes) |
| Low coupling | Private fields, data coupling by value, no globals |
| Singleton | 4 singletons for shared state |
| Fail-safe rollback | Payment failure → seat reverts to AVAILABLE |
| Soft real-time | Logger proves <250ms per operation |

## Admin Features

- View all seats (status, user, time)
- View online users
- View booking history
- **Reset All Seats** — clears all locks/bookings, notifies all users
- **Force-Fail Toggle** — demo payment rollback path

## Deploy to GCP VM

```bash
# On your VM instance, from repo root:
bash setup-vm.sh
```

Installs Docker if needed, starts app + Redis via docker compose. Exposes port 3000.

Open firewall for port 3000 in GCP Console: VPC Network → Firewall → allow tcp:3000.

## Docker

```bash
# Local dev
node server.js

# Docker single instance
docker build -t cinema-ticketing .
docker run -p 3000:3000 cinema-ticketing

# Docker + Redis (multi-instance)
docker compose up -d --build
```

## Test

Open 2-3 browser tabs at http://localhost:3000. Login with different usernames. Click same seat — second user denied (mutex working). Pay to confirm. Admin at http://localhost:3000/admin to reset all state.

```bash
# Automated E2E (install socket.io-client first)
npm install socket.io-client
node -e "..."  # see docs/superpowers/plans/ for test scripts
```
