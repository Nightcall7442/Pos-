# Wespro — Architecture

## Overview

Multi-tenant POS (Point of Sale) system for restaurants and retail.

**Stack:**
- Backend: Express + TypeScript + Prisma + SQLite (dev) / PostgreSQL (prod)
- Frontend Admin: React + TypeScript + Tailwind CSS v4 + Zustand + React Query
- POS Terminal: React + TypeScript + Tailwind CSS v4 (touch-optimized)
- Real-time: Socket.IO
- Auth: JWT (access + refresh tokens)

## Project Structure

```
backend/
├── src/
│   ├── api/              # Route definitions (9 routers)
│   ├── config/           # env.ts (Zod-validated), database.ts (Prisma singleton)
│   ├── middleware/        # auth, errorHandler, rateLimiter, validate, audit
│   ├── modules/          # Domain modules (service + controller + schema)
│   │   ├── auth/         # Login, register, refresh, change-password
│   │   ├── products/     # CRUD + stock adjustment
│   │   ├── categories/   # CRUD + tree + reorder
│   │   ├── orders/       # CRUD + lifecycle + WebSocket gateway
│   │   ├── payments/     # Create + refund + summary
│   │   ├── users/        # CRUD + toggle active
│   │   ├── inventory/    # Stock + movements + alerts
│   │   ├── reports/      # Dashboard + sales + employees
│   │   ├── tables/       # CRUD + status + stats
│   │   └── audit/        # Audit log service
│   └── utils/            # logger (Winston), response helpers
├── prisma/               # schema.prisma + seed.ts
├── tests/                # Integration tests (vitest)
├── scripts/              # Utility scripts
└── Dockerfile

frontend-admin/           # Admin dashboard (port 80)
pos-terminal/             # Touch POS terminal (port 8080)
```

## API Endpoints

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| POST | /api/auth/login | No | - | Login |
| POST | /api/auth/register | No | - | Register new tenant |
| POST | /api/auth/refresh | No | - | Refresh JWT |
| POST | /api/auth/change-password | Yes | * | Change password |
| GET | /api/auth/me | Yes | * | Current user |
| GET | /api/products | Yes | * | List products |
| POST | /api/products | Yes | admin, manager | Create product |
| PUT | /api/products/:id | Yes | admin, manager | Update product |
| DELETE | /api/products/:id | Yes | admin, manager | Delete product |
| POST | /api/products/:id/stock | Yes | admin, manager | Adjust stock |
| GET | /api/categories | Yes | * | List categories |
| POST | /api/categories | Yes | admin, manager | Create category |
| GET | /api/orders | Yes | * | List orders |
| POST | /api/orders | Yes | * | Create order |
| PATCH | /api/orders/:id/status | Yes | * | Update status |
| POST | /api/orders/:id/cancel | Yes | * | Cancel order |
| GET | /api/payments | Yes | * | List payments |
| POST | /api/payments | Yes | admin, manager, cashier | Create payment |
| POST | /api/payments/:id/refund | Yes | admin, manager | Refund |
| GET | /api/users | Yes | * | List users |
| POST | /api/users | Yes | admin, manager | Create user |
| GET | /api/tables | Yes | * | List tables |
| POST | /api/tables | Yes | admin, manager | Create table |
| PATCH | /api/tables/:id/status | Yes | * | Update status |
| GET | /api/inventory/stock | Yes | * | Stock levels |
| GET | /api/inventory/alerts | Yes | * | Low stock alerts |
| GET | /api/reports/dashboard | Yes | * | Dashboard stats |
| GET | /api/reports/sales | Yes | admin, manager | Sales report |
| GET | /api/audit | Yes | admin, manager | Audit logs |

## Order Lifecycle

```
pending → confirmed → preparing → ready → served → completed
    ↓         ↓
 cancelled  cancelled
```

## Multi-tenancy

All data is scoped by `tenantId`. JWT token contains `tenantId`, all queries filter by it.

## WebSocket Events

- `order:created` — new order
- `order:updated` — status changed
- `order:cancelled` — order cancelled
- `order:new` — sent to kitchen channel

## Deployment

```bash
# Development
cd backend && npm install && npm run dev
cd frontend-admin && npm install && npm run dev
cd pos-terminal && npm install && npm run dev

# Production (Docker)
docker-compose up -d
```
