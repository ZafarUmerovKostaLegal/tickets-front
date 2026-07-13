FROM node:22.23.1-alpine AS builder

WORKDIR /app

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    CYPRESS_INSTALL_BINARY=0 \
    NODE_OPTIONS="--max-old-space-size=8192"

# Slim web-only manifests (no Tauri CLI / Playwright / Vitest).
COPY package.docker.json ./package.json
COPY package-lock.docker.json ./package-lock.json
RUN npm ci

COPY scripts/copy-twemoji-assets.mjs scripts/copy-twemoji-assets.mjs
RUN node scripts/copy-twemoji-assets.mjs

COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY scripts ./scripts
COPY src ./src

ARG VITE_API_BASE_URL
ARG VITE_USE_SESSION_COOKIE=true
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_USE_SESSION_COOKIE=$VITE_USE_SESSION_COOKIE

RUN npm run build

FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist ./

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
