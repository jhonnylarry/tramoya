# Etapa 1: compilar el frontend React
FROM node:22-alpine AS front
WORKDIR /front
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Etapa 2: backend Express + frontend compilado
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY --from=front /front/dist ./frontend/dist
# Carpeta de documentos subidos, escribible por el usuario sin privilegios
RUN mkdir -p /app/storage && chown node:node /app/storage
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
