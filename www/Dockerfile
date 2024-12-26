ARG NODE_VERSION=20.18.0

FROM node:${NODE_VERSION}-bullseye-slim as dependencies-env
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt update
RUN corepack enable
COPY . /app

FROM dependencies-env AS development-dependencies-env
COPY ./package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm i --frozen-lockfile

FROM dependencies-env AS production-dependencies-env
COPY ./package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm i --prod --frozen-lockfile

FROM dependencies-env AS build-env
COPY ./package.json pnpm-lock.yaml /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN pnpm build

FROM dependencies-env
RUN apt install -y dumb-init
COPY ./package.json pnpm-lock.yaml /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app

ENV NODE_ENV=production

ENTRYPOINT ["dumb-init"]
CMD ["node", "./build/server/index.js"]
