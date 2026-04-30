FROM golang:1.25-alpine AS go-builder

WORKDIR /src/axl

COPY axl/go.mod axl/go.sum ./
RUN go mod download

COPY axl ./
RUN go build -o /out/node ./cmd/node

FROM node:22-alpine

RUN apk add --no-cache ca-certificates openssl python3 py3-pip py3-setuptools py3-wheel py3-virtualenv

WORKDIR /app
ENV PATH="/opt/venv/bin:$PATH"

COPY --from=go-builder /out/node /app/node
COPY axl/integrations /app/integrations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json turbo.json /app/
COPY backend /app/backend
COPY packages /app/packages
COPY deploy/fly/axl-entrypoint.sh /app/axl-entrypoint.sh
COPY deploy/fly/axl-public-proxy.py /app/axl-public-proxy.py
COPY deploy/fly/axl-public-proxy.mjs /app/axl-public-proxy.mjs

RUN python3 -m venv /opt/venv
RUN pip install "protobuf>=5.29.5,<7" /app/integrations "sse-starlette>=2.1.3"
RUN corepack enable && pnpm install --frozen-lockfile
RUN chmod +x /app/axl-entrypoint.sh

EXPOSE 8080 9001 9002 9003 9004

ENTRYPOINT ["/app/axl-entrypoint.sh"]
