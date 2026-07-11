# ---- deps stage ----
FROM node:20-alpine AS deps
WORKDIR /app

# Chromium (for Puppeteer PDF generation) + build tools for better-sqlite3
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    make \
    g++

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm install --omit=dev

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    DB_DIR=/data

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /data && chown -R app:app /data /app
USER app

EXPOSE 4000
CMD ["node", "src/server.js"]
