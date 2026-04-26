FROM golang:1.25-alpine AS builder

WORKDIR /src/axl

COPY axl/go.mod axl/go.sum ./
RUN go mod download

COPY axl ./
RUN go build -o /out/node ./cmd/node

FROM alpine:3.21

RUN apk add --no-cache ca-certificates openssl python3 py3-pip py3-setuptools py3-wheel py3-virtualenv

WORKDIR /app

COPY --from=builder /out/node /app/node
COPY axl/integrations /app/integrations
COPY deploy/fly/axl-entrypoint.sh /app/axl-entrypoint.sh

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install /app/integrations
RUN chmod +x /app/axl-entrypoint.sh

EXPOSE 9001 9002 9003 9004

ENTRYPOINT ["/app/axl-entrypoint.sh"]
