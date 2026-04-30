# Omen Agent iNFT

Omen can mint an ERC-7857-style iNFT that represents the whole autonomous swarm. The token embeds encrypted swarm intelligence on 0G Storage and stores verifiable data hashes on 0G Chain.

## What Gets Minted

- `OmenAgentVerifier`: verifier contract for ERC-7857 transfer validity proofs.
- `OmenAgentINFT`: iNFT contract with `iTransfer`, `iClone`, `authorizeUsage`, `revokeAuthorization`, `delegateAccess`, `authorizedUsersOf`, and `intelligentDataOf`.
- One iNFT whose encrypted metadata bundle contains:
  - the Omen swarm role graph,
  - all checked-in agent prompt source files,
  - the 0G Compute model used for adjudication,
  - a required 0G memory root or manifest root from a real swarm run.

The mint script fails if `OMEN_INFT_MEMORY_ROOT` or the owner public key is missing. It does not mint placeholder intelligence.

## Generate Owner Key Material

Use an RSA public key for sealing the AES-256-GCM metadata key:

```powershell
New-Item -ItemType Directory -Force local/keys | Out-Null
openssl genrsa -out local/keys/omen-inft-owner-private.pem 4096
openssl rsa -in local/keys/omen-inft-owner-private.pem -pubout -out local/keys/omen-inft-owner-public.pem
```

Keep the private key offline. The mint script only needs the public key.

## Deploy Contracts

Required environment:

```powershell
$env:ZERO_G_RPC_URL="https://evmrpc-testnet.0g.ai"
$env:ZERO_G_PRIVATE_KEY="0x..."
$env:ZERO_G_CHAIN_EXPLORER_BASE_URL="https://chainscan-galileo.0g.ai/tx"
$env:OMEN_INFT_ATTESTOR_ADDRESS="0x..."
$env:OMEN_INFT_OWNER_ADDRESS="0x..."
```

Deploy:

```powershell
pnpm run contracts:compile
pnpm run inft:deploy
```

Save the printed `inft.address` as `OMEN_INFT_CONTRACT_ADDRESS`.

## Mint The Swarm iNFT

Required environment:

```powershell
$env:ZERO_G_INDEXER_URL="https://indexer-storage-testnet-turbo.0g.ai"
$env:ZERO_G_KV_NODE_URL="http://3.101.147.150:6789"
$env:ZERO_G_RPC_URL="https://evmrpc-testnet.0g.ai"
$env:ZERO_G_PRIVATE_KEY="0x..."
$env:ZERO_G_CHAIN_ID="16602"
$env:OMEN_INFT_CONTRACT_ADDRESS="0x..."
$env:OMEN_INFT_RECIPIENT_ADDRESS="0x..."
$env:OMEN_INFT_OWNER_PUBLIC_KEY_PATH="local/keys/omen-inft-owner-public.pem"
$env:OMEN_INFT_MEMORY_ROOT="0g://file/<latest-run-manifest-or-checkpoint-root>"
$env:OMEN_INFT_PROOF_MANIFEST_URI="0g://file/<latest-run-manifest-root>"
$env:OMEN_INFT_LATEST_RUN_ID="<latest-completed-run-id>"
```

Mint:

```powershell
pnpm run inft:mint
```

The script prints the contract address, token ID, transaction explorer URL, encrypted 0G Storage locator, memory root, and on-chain data hashes. Use those fields in the hackathon submission as the proof that the iNFT contains encrypted intelligence and memory.

## Transfer Proof Model

`OmenAgentVerifier` is a production signer-based verifier. It rejects replayed nonces, mismatched old/new data hashes, missing sealed keys, and signatures from untrusted attestors.

For a production transfer, run the re-encryption service in a TEE or equivalent secured oracle, then sign:

- access proof digest as the receiver/access assistant,
- ownership proof digest as an address trusted in `OmenAgentVerifier`.

The iNFT contract only updates data hashes and ownership after the verifier accepts the proof.
