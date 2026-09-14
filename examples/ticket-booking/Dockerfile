FROM node:22-bookworm-slim

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY examples ./examples

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ahi-lab-hacp/core --filter @ahi-lab-hacp/http build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["pnpm", "--filter", "@hacp-example/ticket-booking", "serve"]
