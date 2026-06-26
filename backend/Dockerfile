FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
