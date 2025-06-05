#FROM node:20-alpine
#FROM node:slim
FROM node:24-alpine3.22

WORKDIR /usr/kwirth

COPY package*.json ./

RUN npm install

COPY ./dist ./dist

EXPOSE 3883

CMD [ "node", "--expose-gc", "--no-incremental-marking", "./dist/index.js" ]