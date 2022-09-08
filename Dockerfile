FROM node:18-alpine3.17 AS build
WORKDIR /opt/app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine3.17 AS run
WORKDIR /opt/app
COPY --from=build /opt/app ./
COPY . ./
EXPOSE 3003
CMD ["node", "server", "3003"]
