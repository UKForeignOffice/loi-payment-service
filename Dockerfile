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
RUN find /opt/app -type f \( \
  -name "package-lock.json" -o \
  -name "Gemfile.lock" -o \
  -name "npm-shrinkwrap.json" -o \
  -name "yarn.lock" -o \
  -name "pnpm-lock.yaml" \
\) -delete
EXPOSE 3003
CMD ["node", "server.js", "3003"]
