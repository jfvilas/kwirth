#FROM node:20-alpine
FROM node:slim

WORKDIR /usr/kwirth

COPY package*.json ./

RUN npm install

COPY ./dist ./dist

EXPOSE 3883

CMD [ "node", "--expose-gc", "--no-incremental-marking", "./dist/index.js" ]