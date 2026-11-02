# Build context is the repository root (see .actor/actor.json → dockerContextDir).
FROM apify/actor-node:22 AS builder
COPY --chown=myuser:myuser . ./
RUN npx -y pnpm@10.14.0 install --frozen-lockfile --ignore-scripts \
 && npx -y pnpm@10.14.0 run build \
 && npx -y pnpm@10.14.0 prune --prod \
 && cd apify && npm install --omit=dev --audit=false --fund=false

FROM apify/actor-node:22
COPY --from=builder --chown=myuser:myuser /home/myuser ./
ENV OAUTH_ENABLED=false \
    MCP_PATH=/mcp \
    MCP_SESSION_IDLE_TIMEOUT_MS=1800000 \
    EBAY_ENABLE_FILE_LOGGING=false
CMD ["node", "apify/main.mjs"]
