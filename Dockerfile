FROM node:24-alpine AS build
WORKDIR /opt/app
COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /opt/app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=build /opt/app/dist ./dist
COPY . ./
EXPOSE 3003
CMD ["node", "server.js", "3003"]
