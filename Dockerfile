FROM node:24-alpine AS build
WORKDIR /opt/app
COPY package*.json ./
RUN npm ci --only=production

FROM node:24-alpine AS run
WORKDIR /opt/app
COPY --from=build /opt/app ./
COPY . ./
EXPOSE 3003
CMD ["node", "server", "3003"]
