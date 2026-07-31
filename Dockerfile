# Multi-stage build for BioPass Community (API + admin UI)
FROM node:22-bookworm AS frontend-build
WORKDIR /frontend

# Lefthook preinstall is for local git hooks — skip in image builds
ENV CI=1

COPY frontend/package.json frontend/pnpm-lock.yaml* frontend/package-lock.json* frontend/yarn.lock* ./
RUN corepack enable && \
  if [ -f pnpm-lock.yaml ]; then \
    corepack prepare pnpm@9.1.0 --activate && \
    pnpm install --frozen-lockfile --ignore-scripts; \
  elif [ -f yarn.lock ]; then \
    yarn install --frozen-lockfile --ignore-scripts; \
  else \
    npm install --ignore-scripts; \
  fi

COPY frontend/ ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm build; \
  elif [ -f yarn.lock ]; then yarn build; \
  else npm run build; fi

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-noto-cjk \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3030

COPY backend/package.json backend/yarn.lock* backend/package-lock.json* backend/pnpm-lock.yaml* ./
RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci --omit=dev; \
  else npm install --omit=dev; fi \
  && apt-get purge -y python3 make g++ \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

COPY backend/ ./
COPY --from=frontend-build /frontend/dist ./wwwroot
COPY LICENSE NOTICE ./

RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /app/upload /app/json \
  && chown -R node:node /app \
  && test -f /app/index.js \
  && test -f /app/wwwroot/index.html \
  && test -f /app/LICENSE \
  && test -f /app/NOTICE \
  && test -x /app/docker-entrypoint.sh

USER node

EXPOSE 3030
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node --input-type=module -e "const r=await fetch('http://127.0.0.1:'+(process.env.PORT||3030)+'/ping'); process.exit(r.ok?0:1)"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
