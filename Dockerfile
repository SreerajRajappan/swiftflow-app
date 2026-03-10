FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

ARG SHOPIFY_API_KEY
ENV SHOPIFY_API_KEY=c51a636b3f088fcdb03a770d4ee64992

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force
# Remove CLI packages since we don't need them in production by default.
# Remove this line if you want to run CLI commands in your container.
RUN npm remove @shopify/cli

COPY . .

RUN npx prisma generate
RUN npm run build

ENTRYPOINT []

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run start"]