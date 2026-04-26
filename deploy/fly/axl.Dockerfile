FROM golang:1.25-alpine AS builder

WORKDIR /src/axl

COPY axl/go.mod axl/go.sum ./
RUN go mod download

COPY axl ./
RUN go build -o /out/node ./cmd/node

FROM alpine:3.21

RUN apk add --no-cache ca-certificates openssl

WORKDIR /app

COPY --from=builder /out/node /app/node
COPY deploy/fly/axl-entrypoint.sh /app/axl-entrypoint.sh

RUN chmod +x /app/axl-entrypoint.sh

EXPOSE 9001 9002

ENTRYPOINT ["/app/axl-entrypoint.sh"]
