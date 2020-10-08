FROM 367944766928.dkr.ecr.eu-west-2.amazonaws.com/node/node:latest AS build
WORKDIR /opt/app
COPY package*.json ./
RUN npm ci --only=production

FROM 367944766928.dkr.ecr.eu-west-2.amazonaws.com/node/node:latest AS run
WORKDIR /opt/app
COPY --from=build /opt/app ./
COPY . ./
EXPOSE 3003
CMD ["node", "server", "3003"]
