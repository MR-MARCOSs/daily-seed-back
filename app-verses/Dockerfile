FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

COPY package*.json ./

RUN npm install

COPY . .

COPY docker-entrypoint.sh /usr/local/bin/

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3333

USER node

ENTRYPOINT ["dumb-init", "docker-entrypoint.sh"]

CMD ["npm", "run", "start"]