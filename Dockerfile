# Build packs auto-detect this repo as a static site and serve dist/ with Caddy,
# which drops the /cdn proxy and the /wisp websocket the proxy depends on. Ship
# an explicit image instead so the Node server in server.ts is always what runs.
FROM node:22-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3003

EXPOSE 3003

CMD ["pnpm", "start"]
