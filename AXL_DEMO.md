# Omen AXL Evidence Brief

Omen uses Gensyn AXL as the communication layer for a deployed autonomous market-intelligence swarm. The demo is not an in-process simulation and does not use a centralized message broker in place of AXL. Each swarm role runs as a separate Fly app with its own AXL node identity, local MCP router, Omen role host, and A2A callback server.

The primary entrypoint is `https://omen-axl-node.fly.dev`. It delegates work over AXL to independently deployed role nodes using explicit peer IDs.

## Why This Qualifies

- **Separate AXL nodes:** The swarm is deployed as 12 Fly apps, one orchestrator node plus 11 role nodes.
- **Inter-node communication:** Role work is delegated by A2A calls through AXL to target peer IDs.
- **No replacement broker:** The role apps do not share an in-process bus, queue, or centralized message broker for agent communication.
- **Direct agent-to-agent evidence:** The writer role performs a peer-to-peer AXL MCP call to the memory role before returning its article output.
- **Inspectable proof:** Public topology endpoints expose live AXL peer identities, and the verifier validates role responses against production schemas.

## Deployed AXL Network

| Role | Fly app | Public endpoint | AXL peer ID |
| --- | --- | --- | --- |
| orchestrator | `omen-axl-node` | `https://omen-axl-node.fly.dev` | `5a0c250776116d3c4a7f15bd7b65ab32c61dd2bea3292a7b5cb5f67c51ddf239` |
| market_bias | `omen-axl-market-bias` | `https://omen-axl-market-bias.fly.dev` | `f49cc2cf8f293c4133de1ebfcc8cdf096fc5e8b55f7df3707d59440db79b6bf1` |
| scanner | `omen-axl-scanner` | `https://omen-axl-scanner.fly.dev` | `75f01a9f5b3403b6e6ab5ad3a74fc5b7716a2c16030c5eb341ac5e0e91f1f9d8` |
| research | `omen-axl-research` | `https://omen-axl-research.fly.dev` | `26525371a36223fa440bc2bb81fe44ae33c7cc0be66f92e50a5d27c84a9a09ed` |
| chart_vision | `omen-axl-chart-vision` | `https://omen-axl-chart-vision.fly.dev` | `394005c77fafb59fc113b8e5ceceb8d77f98236f97ae97434db7fadf14c90d04` |
| analyst | `omen-axl-analyst` | `https://omen-axl-analyst.fly.dev` | `9926348dd39a7ab3ac7812dc870fb7e71797e2b39eb8c96837f999c3e8121d1c` |
| critic | `omen-axl-critic` | `https://omen-axl-critic.fly.dev` | `62070e8c10996fb57ef05b1c2ab22c18dd1a9fabc7b7a3124d9a1dc4c9cddebc` |
| intel | `omen-axl-intel` | `https://omen-axl-intel.fly.dev` | `ea5590d48048e5e4f2c9c22c8f18238a9c6fc709d8603ca7ede78cabc8ba237b` |
| generator | `omen-axl-generator` | `https://omen-axl-generator.fly.dev` | `17e9e6c75f85e49c8e12bc6d909e3095fc7b945ce7b66c5bb5e53e61c6255989` |
| writer | `omen-axl-writer` | `https://omen-axl-writer.fly.dev` | `5d138fdd6e4b1fe79a661ec924548b7db14079a91841337920bbade5d40a7ca6` |
| memory | `omen-axl-memory` | `https://omen-axl-memory.fly.dev` | `b9c37993dbe718883eb6904cbef54d1687c1f43160677bee55342eab71e026e8` |
| publisher | `omen-axl-publisher` | `https://omen-axl-publisher.fly.dev` | `14d3925be85ca5197c694610690670fa721d628766874b2215497b818591b373` |

Each deployed app runs:

- AXL node binary
- public HTTP proxy
- MCP router
- Omen MCP role host
- A2A callback server

## Live Topology Checks

The orchestrator topology endpoint exposes the live public key for the entrypoint node and its known peers:

```powershell
Invoke-RestMethod https://omen-axl-node.fly.dev/topology
```

An individual role node exposes a different AXL peer identity:

```powershell
Invoke-RestMethod https://omen-axl-writer.fly.dev/topology
```

The deployed Fly apps can also be listed directly:

```powershell
fly apps list
```

Expected result: 12 deployed `omen-axl-*` apps, including `omen-axl-node`, `omen-axl-market-bias`, `omen-axl-scanner`, `omen-axl-research`, `omen-axl-chart-vision`, `omen-axl-analyst`, `omen-axl-critic`, `omen-axl-intel`, `omen-axl-generator`, `omen-axl-writer`, `omen-axl-memory`, and `omen-axl-publisher`.

## End-To-End A2A Verification

The verifier sends A2A delegation requests from the orchestrator node to each role's AXL peer ID. Each response must complete successfully and validate against that role's production output schema.

```powershell
$env:AXL_NODE_BASE_URL="https://omen-axl-node.fly.dev"
$env:AXL_MARKET_BIAS_NODE_ID="f49cc2cf8f293c4133de1ebfcc8cdf096fc5e8b55f7df3707d59440db79b6bf1"
$env:AXL_SCANNER_NODE_ID="75f01a9f5b3403b6e6ab5ad3a74fc5b7716a2c16030c5eb341ac5e0e91f1f9d8"
$env:AXL_RESEARCH_NODE_ID="26525371a36223fa440bc2bb81fe44ae33c7cc0be66f92e50a5d27c84a9a09ed"
$env:AXL_CHART_VISION_NODE_ID="394005c77fafb59fc113b8e5ceceb8d77f98236f97ae97434db7fadf14c90d04"
$env:AXL_ANALYST_NODE_ID="9926348dd39a7ab3ac7812dc870fb7e71797e2b39eb8c96837f999c3e8121d1c"
$env:AXL_CRITIC_NODE_ID="62070e8c10996fb57ef05b1c2ab22c18dd1a9fabc7b7a3124d9a1dc4c9cddebc"
$env:AXL_INTEL_NODE_ID="ea5590d48048e5e4f2c9c22c8f18238a9c6fc709d8603ca7ede78cabc8ba237b"
$env:AXL_GENERATOR_NODE_ID="17e9e6c75f85e49c8e12bc6d909e3095fc7b945ce7b66c5bb5e53e61c6255989"
$env:AXL_WRITER_NODE_ID="5d138fdd6e4b1fe79a661ec924548b7db14079a91841337920bbade5d40a7ca6"
$env:AXL_MEMORY_NODE_ID="b9c37993dbe718883eb6904cbef54d1687c1f43160677bee55342eab71e026e8"
$env:AXL_PUBLISHER_NODE_ID="14d3925be85ca5197c694610690670fa721d628766874b2215497b818591b373"
pnpm run axl:verify:a2a
```

Expected result:

- `allOk: true`
- each role result has `state: "completed"`
- each role result has `schemaOk: true`
- each result shows the exact `targetPeerId` used for the AXL delegation

The verifier also supports a shorter core-path check:

```powershell
$env:AXL_VERIFY_PROFILE="core"
pnpm run axl:verify:a2a
```

The core profile verifies `market_bias`, `scanner`, `research`, `analyst`, and `critic`.

## Direct Writer-To-Memory AXL Evidence

The full verifier includes a direct role-to-role communication proof. During `writer.article`, the writer node calls the memory node through AXL before drafting long-form intel.

Expected verifier summary for the writer role:

```json
{
  "hasArticle": true,
  "peerContext": {
    "sourcePeerId": "b9c37993dbe718883eb6904cbef54d1687c1f43160677bee55342eab71e026e8",
    "service": "memory",
    "method": "memory.recall"
  }
}
```

This proves the writer node reached the separate memory node by peer ID and incorporated returned context into its result. The call is not orchestrator fanout.

## Latest Verified Run

The deployed AXL network was verified from this repository with:

```powershell
pnpm run axl:verify:a2a
```

Observed result:

- `baseUrl`: `https://omen-axl-node.fly.dev`
- orchestrator peer ID: `5a0c250776116d3c4a7f15bd7b65ab32c61dd2bea3292a7b5cb5f67c51ddf239`
- `allOk`: `true`
- all 11 role delegations completed
- all 11 role outputs passed schema validation
- writer returned memory peer context from `memory.recall`

## Local Development Fallback

The repository also includes a local split-node launcher for development:

```powershell
pnpm run axl:start:demo
```

This local path is not the primary sponsor demo. It remains useful for offline development and regression testing when the Fly deployment is unavailable.

Stop local nodes:

```powershell
pnpm run axl:stop:demo
```
