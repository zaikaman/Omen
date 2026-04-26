#!/bin/sh
set -eu

DATA_DIR="/data"
RUNTIME_DIR="/app/runtime"
PRIVATE_KEY_PATH="${AXL_PRIVATE_KEY_PATH:-$DATA_DIR/private.pem}"
CONFIG_PATH="$RUNTIME_DIR/node-config.json"

mkdir -p "$DATA_DIR" "$RUNTIME_DIR"

if [ ! -f "$PRIVATE_KEY_PATH" ]; then
  if [ -n "${AXL_PRIVATE_KEY_B64:-}" ]; then
    echo "$AXL_PRIVATE_KEY_B64" | base64 -d > "$PRIVATE_KEY_PATH"
  else
    openssl genpkey -algorithm ed25519 -out "$PRIVATE_KEY_PATH"
  fi
fi

cat > "$CONFIG_PATH" <<EOF
{
  "PrivateKeyPath": "$PRIVATE_KEY_PATH",
  "Peers": ${AXL_PEERS_JSON:-[]},
  "Listen": ${AXL_LISTEN_JSON:-["tls://0.0.0.0:9001"]},
  "bridge_addr": "${AXL_BRIDGE_ADDR:-0.0.0.0}",
  "api_port": ${AXL_API_PORT:-9002},
  "tcp_port": ${AXL_TCP_PORT:-7000}
}
EOF

exec /app/node -config "$CONFIG_PATH"
