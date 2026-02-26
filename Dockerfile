# ─── Stage 1: Install dependencies ───
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/

RUN npm ci --ignore-scripts

# ─── Stage 2: Build shared types ───
FROM deps AS build-shared
WORKDIR /app

COPY shared/ shared/
RUN npm run build -w shared

# ─── Stage 3: Build frontend ───
FROM build-shared AS build-frontend
WORKDIR /app

COPY apps/frontend/ apps/frontend/
RUN npm run build -w apps/frontend

# ─── Stage 4: Build backend ───
FROM build-shared AS build-backend
WORKDIR /app

COPY apps/backend/prisma/ apps/backend/prisma/
COPY apps/backend/src/ apps/backend/src/
COPY apps/backend/tsconfig.json apps/backend/
COPY tsconfig.base.json ./
RUN npm run build -w apps/backend

# ─── Stage 5: Production image ───
FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache sqlite

ENV NODE_ENV=production
ENV PORT=3007

# Copy package files and install production deps only
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN npm ci --omit=dev --ignore-scripts

# Copy built artifacts
COPY --from=build-shared /app/shared/dist/ shared/dist/
COPY --from=build-shared /app/shared/package.json shared/
COPY --from=build-backend /app/apps/backend/dist/ apps/backend/dist/
COPY --from=build-backend /app/apps/backend/prisma/ apps/backend/prisma/
COPY --from=build-frontend /app/apps/frontend/dist/ apps/frontend/dist/

# Generate Prisma client for production
RUN cd apps/backend && npx prisma generate

# Create data directory for SQLite
RUN mkdir -p /data && chown -R node:node /data
VOLUME /data

USER node

EXPOSE 3007

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3007/health || exit 1

CMD ["node", "apps/backend/dist/index.js"]
