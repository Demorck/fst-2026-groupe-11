FROM node:24-slim
# the Prisma schema engine (migrate deploy) links against libssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
# dev dependencies stay: prisma CLI runs migrations at startup and tsx runs the demo seed
# prisma.config.ts reads DATABASE_URL even for generate (postinstall), any value works here
RUN DATABASE_URL=postgresql://build@localhost/build npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
