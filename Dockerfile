FROM node:22-alpine AS build
WORKDIR /opt/app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS run
WORKDIR /opt/app
COPY --from=build /opt/app ./
COPY . ./
RUN npm install pm2 -g
EXPOSE 3003
CMD ["pm2-runtime", "pm2.config.js"]