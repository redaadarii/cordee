# Image de l'API : construite depuis la racine du monorepo.
#   docker build -f docker/api.Dockerfile -t cordee-api .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @cordee/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @cordee/api... run build \
 && pnpm --filter @cordee/api deploy --prod --legacy /out \
 && cp -r apps/api/dist apps/api/drizzle /out/

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=build --chown=node:node /out .
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
VOLUME /data/uploads
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1
# Les migrations passent au démarrage : une base vide est prête au premier lancement.
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/main.js"]
