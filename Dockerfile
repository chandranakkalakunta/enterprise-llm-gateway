FROM node:22-bookworm-slim AS build
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .nvmrc ./
COPY apps/gateway/package.json apps/gateway/package.json
RUN pnpm install --frozen-lockfile

COPY apps/gateway apps/gateway
RUN pnpm --filter @ellmgw/gateway build
RUN pnpm --filter @ellmgw/gateway deploy --prod --legacy /out

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

USER node
COPY --from=build --chown=node:node /out .

EXPOSE 8080
CMD ["node", "dist/server.js"]
