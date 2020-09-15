FROM node:12.18.3-alpine3.12 AS build
WORKDIR /opt/app
COPY package*.json ./
RUN npm ci --only=production

FROM node:12.18.3-alpine3.12 AS run
WORKDIR /opt/app
COPY --from=build /opt/app ./
COPY . ./
EXPOSE 3003
CMD ["node", "server", "3003"]
