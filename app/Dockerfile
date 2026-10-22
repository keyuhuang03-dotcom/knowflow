# Build from repository root: docker build -f app/Dockerfile .
FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/tmp/knowflow-build.db
COPY app/package*.json ./
COPY app/prisma ./prisma
RUN npm ci
COPY app/ ./
RUN npm run build -- --webpack && node scripts/build-runtime-config.mjs

FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PYTHONDONTWRITEBYTECODE=1
ENV DATABASE_URL=file:/data/kaoyan.db MISTAKE_SKILL_PYTHON=/opt/mistake-python/bin/python
ENV BACKUP_ROOT=/data/backups BACKUP_TOOL_PATH=/app/tools/export-cloud-data.py
COPY app/package*.json ./
COPY app/prisma ./prisma
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY app/public ./public
COPY app/src ./src
COPY app/scripts ./scripts
COPY app/tsconfig.json ./tsconfig.json
COPY app/vendor ./vendor
COPY scripts/export-cloud-data.py scripts/verify-backup.py ./tools/
RUN python3 -m venv /opt/mistake-python \
    && /opt/mistake-python/bin/pip install --no-cache-dir -r vendor/mistake-learning/requirements.txt \
    && mkdir -p /data /app/.next/cache && chown -R node:node /data /app/.next/cache \
    && chmod 700 /data && chmod 755 scripts/container-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["/app/scripts/container-entrypoint.sh"]
CMD ["web"]
