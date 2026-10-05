
FROM node:22-bookworm-slim

WORKDIR /app

# Dependencias necesarias para Prisma
RUN apt-get update \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

# Copiamos primero los archivos necesarios para instalar
COPY package.json package-lock.json ./

# Prisma necesita el schema durante el postinstall
COPY prisma ./prisma
COPY prisma.config.ts ./

# Instalar dependencias
RUN npm install

# Copiar el resto del proyecto
COPY . .

# Generar Prisma Client explícitamente
RUN npx prisma generate

# Compilar Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
