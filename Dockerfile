# syntax=docker/dockerfile:1.6
#
# SafeBox Energy IMS — production image
# Multi-stage build:
#   1. client-builder  → builds the React/Vite SPA
#   2. server-deps     → installs production node_modules (compiles better-sqlite3)
#   3. runtime         → minimal alpine image, non-root, tini PID-1

# ── Stage 1: Build the React client ─────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /build/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ── Stage 2: Install production server dependencies ─────────────────────────
FROM node:20-alpine AS server-deps
# Native toolchain required by better-sqlite3 (node-gyp)
RUN apk add --no-cache python3 make g++
WORKDIR /build
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# ── Stage 3: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# tini = proper PID-1, forwards signals so SIGTERM/SIGINT shut the server down cleanly
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/data/safebox.db

WORKDIR /app

# Production node_modules (compiled native bindings included)
COPY --from=server-deps /build/node_modules ./node_modules
COPY --from=server-deps /build/package*.json ./

# Server source
COPY server ./server

# Built SPA — server/index.js serves ../client/dist when NODE_ENV=production
COPY --from=client-builder /build/client/dist ./client/dist

# Entrypoint that seeds the DB on first run (idempotent)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Persistent data directory — mount a volume here to persist the SQLite file
RUN mkdir -p /data && chown -R node:node /data /app

USER node

EXPOSE 3001

# Hits the API; login with no body returns 400 (<500 ⇒ healthy)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/api/auth/login',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
