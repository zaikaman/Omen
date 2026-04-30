import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import solc from "solc";

const repoRoot = process.cwd();

const contracts = [
  "contracts/OmenRunRegistry.sol",
  "contracts/OmenAgentVerifier.sol",
  "contracts/OmenAgentINFT.sol",
];

const sources = Object.fromEntries(
  await Promise.all(
    contracts.map(async (contractPath) => [
      contractPath,
      { content: await readFile(path.join(repoRoot, contractPath), "utf8") },
    ]),
  ),
);

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors ?? [];
const fatalErrors = errors.filter((error) => error.severity === "error");

for (const error of errors) {
  const stream = error.severity === "error" ? process.stderr : process.stdout;
  stream.write(`${error.formattedMessage}\n`);
}

if (fatalErrors.length > 0) {
  process.exitCode = 1;
  throw new Error("Solidity compilation failed.");
}

const artifacts = [
  {
    source: "contracts/OmenRunRegistry.sol",
    contract: "OmenRunRegistry",
    outFile: "packages/zero-g/src/chain/omen-run-registry.ts",
    exportName: "omenRunRegistry",
  },
  {
    source: "contracts/OmenAgentVerifier.sol",
    contract: "OmenAgentVerifier",
    outFile: "packages/zero-g/src/chain/omen-agent-verifier.ts",
    exportName: "omenAgentVerifier",
  },
  {
    source: "contracts/OmenAgentINFT.sol",
    contract: "OmenAgentINFT",
    outFile: "packages/zero-g/src/chain/omen-agent-inft.ts",
    exportName: "omenAgentInft",
  },
];

for (const artifact of artifacts) {
  const compiled = output.contracts?.[artifact.source]?.[artifact.contract];

  if (!compiled) {
    throw new Error(`Missing compiled artifact for ${artifact.contract}.`);
  }

  const content = [
    `export const ${artifact.exportName}Abi = ${JSON.stringify(compiled.abi, null, 2)} as const;`,
    "",
    `export const ${artifact.exportName}Bytecode = "0x${compiled.evm.bytecode.object}";`,
    "",
  ].join("\n");

  await writeFile(path.join(repoRoot, artifact.outFile), content);
  process.stdout.write(`Wrote ${artifact.outFile}\n`);
}
