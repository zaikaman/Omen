import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

import { omenRunRegistryAbi, omenRunRegistryBytecode } from "../chain/omen-run-registry.js";

const requireEnv = (name: string) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const main = async () => {
  const rpcUrl = requireEnv("ZERO_G_RPC_URL");
  const privateKey = requireEnv("ZERO_G_PRIVATE_KEY");
  const provider = new JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  const factory = new ContractFactory(
    omenRunRegistryAbi,
    omenRunRegistryBytecode,
    signer,
  );

  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deploymentTransaction = contract.deploymentTransaction();

  console.log(`OmenRunRegistry deployed: ${address}`);
  if (deploymentTransaction) {
    console.log(`Deployment transaction: ${deploymentTransaction.hash}`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
