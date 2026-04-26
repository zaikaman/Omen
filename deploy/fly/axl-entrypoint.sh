#!/bin/sh
set -eu

DATA_DIR="/data"
RUNTIME_DIR="/app/runtime"
PRIVATE_KEY_PATH="${AXL_PRIVATE_KEY_PATH:-$DATA_DIR/private.pem}"
CONFIG_PATH="$RUNTIME_DIR/node-config.json"
ROUTER_ADDR="${AXL_ROUTER_ADDR:-http://127.0.0.1}"
ROUTER_PORT="${AXL_ROUTER_PORT:-9003}"
A2A_ADDR="${AXL_A2A_ADDR:-http://127.0.0.1}"
A2A_PORT="${AXL_A2A_PORT:-9004}"

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
  "tcp_port": ${AXL_TCP_PORT:-7000},
  "router_addr": "$ROUTER_ADDR",
  "router_port": ${ROUTER_PORT},
  "a2a_addr": "$A2A_ADDR",
  "a2a_port": ${A2A_PORT}
}
EOF

python3 -m mcp_routing.mcp_router --port "$ROUTER_PORT" &
ROUTER_PID=$!

python3 -m a2a_serving.a2a_server --host 127.0.0.1 --port "$A2A_PORT" --router "${ROUTER_ADDR}:${ROUTER_PORT}" &
A2A_PID=$!

/app/node -config "$CONFIG_PATH" &
NODE_PID=$!

cleanup() {
  kill "$NODE_PID" "$A2A_PID" "$ROUTER_PID" 2>/dev/null || true
  wait "$NODE_PID" "$A2A_PID" "$ROUTER_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

wait "$NODE_PID"
