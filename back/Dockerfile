FROM node:20-alpine

WORKDIR /usr/kwirth

COPY package*.json ./

RUN npm install

COPY ./dist ./dist

EXPOSE 3883

CMD [ "node", "./dist/index.js" ]