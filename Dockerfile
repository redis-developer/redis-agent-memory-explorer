# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/cau-logger/package.json packages/cau-logger/
COPY packages/cau-redis/package.json packages/cau-redis/
COPY packages/cau-api-server/package.json packages/cau-api-server/
COPY packages/cau-ram/package.json packages/cau-ram/
COPY packages/context-surfaces-ts-sdk/package.json packages/context-surfaces-ts-sdk/
COPY packages/cau-context-surfaces/package.json packages/cau-context-surfaces/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

# ── Stage 2: Build workspace packages ──
FROM deps AS packages
COPY packages/ packages/
RUN npm run build:packages

# ── Stage 3: Build frontend static export ──
FROM packages AS frontend-build
COPY frontend/ frontend/
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL="/copilotkit"
RUN npm run build -w frontend

# ── Stage 4: Production app image ──
FROM node:20-alpine AS app
RUN apk add --no-cache curl
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/cau-logger/package.json packages/cau-logger/
COPY packages/cau-redis/package.json packages/cau-redis/
COPY packages/cau-api-server/package.json packages/cau-api-server/
COPY packages/cau-ram/package.json packages/cau-ram/
COPY packages/context-surfaces-ts-sdk/package.json packages/context-surfaces-ts-sdk/
COPY packages/cau-context-surfaces/package.json packages/cau-context-surfaces/
COPY backend/package.json backend/

RUN npm ci --omit=dev

COPY --from=packages /app/packages/ packages/
COPY backend/ backend/
COPY data/ data/
COPY --from=frontend-build /app/frontend/out/ backend/public/

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV MEETING_MEMORY_PORT=3001
ENV MEETING_MEMORY_DATA_DIR=/app/data
ENV MEETING_MEMORY_ALLOWED_ORIGINS=*

EXPOSE 3001

WORKDIR /app/backend
CMD ["npx", "tsx", "src/index.ts"]
