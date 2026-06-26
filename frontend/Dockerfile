FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
COPY src ./src

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
