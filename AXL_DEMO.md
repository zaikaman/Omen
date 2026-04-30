# AXL Split-Node Demo

This demo starts Omen's AXL path as multiple local node identities on one machine. It is meant for the hackathon video and local sponsor validation, not as a replacement for the single Fly deployment path.

## Core Demo

Start the core split-node path:

```powershell
pnpm run axl:start:demo
```

This starts:

- `orchestrator`: AXL API on `http://127.0.0.1:9002`; also hosts non-core support services for a full Omen run.
- `scanner`: separate AXL node and scanner MCP/A2A service.
- `research`: separate AXL node and research MCP/A2A service.
- `analyst`: separate AXL node and analyst MCP/A2A service.
- `critic`: separate AXL node and critic MCP/A2A service.

Runtime files are written under `local/axl/demo/<role>`. Logs are written under `local/logs/axl-demo`.

The local AXL binary currently uses the default A2A callback port, so the demo runs one shared Omen A2A router on `127.0.0.1:9004`. Each role still has its own AXL node identity, AXL API port, MCP router, MCP host, service registration, and peer ID; the shared A2A router dispatches inbound A2A payloads to the correct role router.

The launcher writes the backend env snippet to:

```text
local/axl/demo/axl-demo.env
```

Use those values for the backend process so the UI can show the real peer IDs, registered services, route receipts, and A2A completion snapshots.

## Full Role Demo

To launch every current Omen role as its own local AXL node:

```powershell
pnpm run axl:start:demo:all
```

## Verification

After the nodes are running and the generated env values are loaded:

```powershell
pnpm run axl:verify:a2a
```

The verifier sends core A2A delegations to the configured role peer IDs and prints each role's target peer, completion state, schema validation result, and summary. Use `AXL_VERIFY_PROFILE=all` to include the non-core support services.

## Stop

```powershell
pnpm run axl:stop:demo
```
