import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

import {
  omenAgentInftAbi,
  omenAgentInftBytecode,
} from "../chain/omen-agent-inft.js";
import {
  omenAgentVerifierAbi,
  omenAgentVerifierBytecode,
} from "../chain/omen-agent-verifier.js";

const requireEnv = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const optionalEnv = (name: string) => process.env[name]?.trim() || null;

const buildExplorerUrl = (baseUrl: string | null, txHash: string) => {
  if (!baseUrl) {
    return null;
  }

  const trimmed = baseUrl.replace(/\/$/, "");

  return trimmed.endsWith("/tx") ? `${trimmed}/${txHash}` : `${trimmed}/tx/${txHash}`;
};

const main = async () => {
  const rpcUrl = requireEnv("ZERO_G_RPC_URL");
  const privateKey = requireEnv("ZERO_G_PRIVATE_KEY");
  const owner = optionalEnv("OMEN_INFT_OWNER_ADDRESS");
  const attestor = requireEnv("OMEN_INFT_ATTESTOR_ADDRESS");
  const name = optionalEnv("OMEN_INFT_NAME") ?? "Omen Autonomous Swarm";
  const symbol = optionalEnv("OMEN_INFT_SYMBOL") ?? "OMENAI";
  const storageInfo =
    optionalEnv("OMEN_INFT_STORAGE_INFO") ??
    "Encrypted Omen swarm intelligence and memory are stored on 0G Storage.";
  const contractUri = optionalEnv("OMEN_INFT_CONTRACT_URI") ?? "";
  const explorerBaseUrl = optionalEnv("ZERO_G_CHAIN_EXPLORER_BASE_URL");
  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  const ownerAddress = owner ?? signer.address;

  const verifierFactory = new ContractFactory(
    omenAgentVerifierAbi,
    omenAgentVerifierBytecode,
    signer,
  );
  const verifier = await verifierFactory.deploy(ownerAddress, attestor);
  await verifier.waitForDeployment();

  const verifierAddress = await verifier.getAddress();
  const verifierDeployTx = verifier.deploymentTransaction();

  const inftFactory = new ContractFactory(
    omenAgentInftAbi,
    omenAgentInftBytecode,
    signer,
  );
  const inft = await inftFactory.deploy(
    name,
    symbol,
    storageInfo,
    contractUri,
    verifierAddress,
    ownerAddress,
  );
  await inft.waitForDeployment();

  const inftAddress = await inft.getAddress();
  const inftDeployTx = inft.deploymentTransaction();

  console.log(
    JSON.stringify(
      {
        verifier: {
          address: verifierAddress,
          transactionHash: verifierDeployTx?.hash ?? null,
          explorerUrl: verifierDeployTx
            ? buildExplorerUrl(explorerBaseUrl, verifierDeployTx.hash)
            : null,
        },
        inft: {
          address: inftAddress,
          transactionHash: inftDeployTx?.hash ?? null,
          explorerUrl: inftDeployTx ? buildExplorerUrl(explorerBaseUrl, inftDeployTx.hash) : null,
        },
        owner: ownerAddress,
        attestor,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
