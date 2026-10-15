# Imagen de la API para docker compose (en Vercel no se usa).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
COPY public ./public
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 3000
# Migra el esquema, carga los datos de demostración y arranca el servidor.
CMD ["sh", "-c", "node scripts/migrate.js && node scripts/seed.js && node scripts/serve.js"]
