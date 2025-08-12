# Usa una imagen base de Node.js
FROM node:18-alpine

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de configuración de dependencias
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código de tu aplicación
COPY . .

# Genera el Prisma Client para el entorno de producción
RUN npx prisma generate

# Expone el puerto que tu aplicación usa
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "index.js"]