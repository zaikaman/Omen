# AXL Split-Node Demo

This demo starts Omen's AXL path as multiple local node identities on one machine. It is meant for the hackathon video and local sponsor validation, not as a replacement for the single Fly deployment path.

## Full Role Demo

Start the full split-node path:

```powershell
pnpm run axl:start:demo
```

This starts:

- `orchestrator`: AXL API on `http://127.0.0.1:9002`; owns the local A2A callback adapter used by the AXL node callback port.
- `market_bias`: separate AXL node and market-bias MCP/A2A service.
- `scanner`: separate AXL node and scanner MCP/A2A service.
- `research`: separate AXL node and research MCP/A2A service.
- `chart_vision`: separate AXL node and chart-vision MCP/A2A service.
- `analyst`: separate AXL node and analyst MCP/A2A service.
- `critic`: separate AXL node and critic MCP/A2A service.
- `intel`: separate AXL node and intel MCP/A2A service.
- `generator`: separate AXL node and generator MCP/A2A service.
- `writer`: separate AXL node and writer MCP/A2A service.
- `memory`: separate AXL node and memory MCP/A2A service.
- `publisher`: separate AXL node and publisher MCP/A2A service.

Runtime files are written under `local/axl/demo/<role>`. Logs are written under `local/logs/axl-demo`.

The launcher builds `local/axl/node.exe` from the checked-in `axl/cmd/node` source when the binary is missing or older than the source tree. Node configs set `a2a_peer_timeout_secs` and `mcp_peer_timeout_secs` to `300`, so long real agent calls can complete without the old 30-second peer cutoff.

The local AXL binary currently uses the default A2A callback port, so the demo runs one local Omen A2A callback adapter on `127.0.0.1:9004`. This adapter is not a message broker and does not replace AXL routing. It only receives the AXL node's local A2A callback, requires an explicit peer ID for the requested role, and calls the orchestrator AXL MCP endpoint (`/mcp/{peerId}/{service}`). Execution still flows through AXL to the target role node's Python MCP router before reaching that role's Omen MCP host.

The demo intentionally fails when a role peer ID is missing. It no longer maps missing roles to the orchestrator peer ID and no longer uses `AXL_SERVICE_PEER_ID` as a generic service fallback. Each role must have its own captured peer ID in `local/axl/demo/<role>/peer-id.txt` or an explicit `AXL_<ROLE>_NODE_ID` environment value.

The launcher writes the backend env snippet to:

```text
local/axl/demo/axl-demo.env
```

Use those values for the backend process so the UI can show the real peer IDs, registered services, route receipts, and A2A completion snapshots.

## Core-Only Demo

To launch the older five-node judging path only:

```powershell
pnpm run axl:start:demo:core
```

## Verification

After the nodes are running and the generated env values are loaded:

```powershell
pnpm run axl:verify:a2a
```

The verifier sends A2A delegations to the configured role peer IDs and prints each role's target peer, completion state, schema validation result, and summary. It verifies every role by default. Use `AXL_VERIFY_PROFILE=core` to verify only the five-node core path.

## Stop

```powershell
pnpm run axl:stop:demo
```
