FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV DATABASE_URL=file:/tmp/kaoyan-build.db
COPY package*.json ./
RUN npm ci
COPY . .
RUN python3 -m venv /opt/mistake-python \
    && /opt/mistake-python/bin/pip install --no-cache-dir -r vendor/mistake-learning/requirements.txt \
    && npm run build -- --webpack
ENV NODE_ENV=production
ENV MISTAKE_SKILL_PYTHON=/opt/mistake-python/bin/python
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && exec npm run start -- --hostname 0.0.0.0 --port 3000"]
