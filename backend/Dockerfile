FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/uploads ./uploads
RUN npx prisma generate
EXPOSE 3000
# Schema changes are applied as reviewed migrations. `migrate deploy` never
# drops data — an incompatible schema fails the deploy instead of silently
# wiping the volume, which `db push --accept-data-loss` used to do on every
# container start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
