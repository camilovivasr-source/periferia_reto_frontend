FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
ENV NODE_ENV=production PORT=8080 BACKEND_AUTH=iam
EXPOSE 8080
CMD ["npm","start"]
