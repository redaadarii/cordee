# Image du front : fichiers statiques servis par nginx, qui relaie /api et /socket.io vers l'API.
#   docker build -f docker/web.Dockerfile -t cordee-web .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @cordee/web...
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @cordee/web... run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
