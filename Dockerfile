FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM base AS production-dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
RUN mkdir -p public && npm run db:generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma
COPY --from=builder /app/package.json ./package.json
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

FROM base AS worker
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma
COPY --from=builder /app/src/worker.ts ./src/worker.ts
COPY --from=builder /app/src/lib/email-transport.ts ./src/lib/email-transport.ts
COPY --from=builder /app/src/lib/email-address.ts ./src/lib/email-address.ts
COPY --from=builder /app/src/lib/integration-status.ts ./src/lib/integration-status.ts
COPY --from=builder /app/src/lib/r2-buckets.ts ./src/lib/r2-buckets.ts
COPY --from=builder /app/src/lib/xendit-config.ts ./src/lib/xendit-config.ts
COPY --from=builder /app/src/lib/media-processing.ts ./src/lib/media-processing.ts
COPY --from=builder /app/src/lib/worker-health.ts ./src/lib/worker-health.ts
COPY --from=builder /app/scripts/healthcheck-worker.ts ./scripts/healthcheck-worker.ts
COPY --from=builder /app/scripts/seed-staging-public-fixture.ts ./scripts/seed-staging-public-fixture.ts
COPY --from=builder /app/package.json ./package.json
USER nextjs
CMD ["npm", "run", "worker"]

FROM builder AS migrate
ENV NODE_ENV=production
CMD ["npm", "run", "db:deploy"]
