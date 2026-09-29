# Backend API

Express + TypeScript + Prisma backend for Wespro.

## Setup

```bash
npm install
cp .env.example .env
# Configure .env with your database URL
npx prisma generate
npx prisma db push
npm run dev
```

## Development

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed initial data
npm run test         # Run tests
```
