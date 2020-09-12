FROM node:12 as builder
WORKDIR /app

COPY ./package.json ./
RUN npm install

COPY ./tsconfig.json ./tsconfig.build.json ./
COPY ./app ./app
RUN npm run build

FROM node:12-alpine
WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

RUN npm install --production --ignore-scripts --prefer-offline

COPY --from=builder /app/dist ./dist

CMD yarn run start:prod