import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { omenAgentInftAbi } from "../chain/omen-agent-inft.js";

const functionNames = new Set(
  omenAgentInftAbi.filter((entry) => entry.type === "function").map((entry) => entry.name),
);

const eventNames = new Set(
  omenAgentInftAbi.filter((entry) => entry.type === "event").map((entry) => entry.name),
);

const findFunction = (name: string) => {
  const entry = omenAgentInftAbi.find(
    (abiEntry) => abiEntry.type === "function" && abiEntry.name === name,
  );

  if (!entry || entry.type !== "function") {
    throw new Error(`Missing function ${name}`);
  }

  return entry;
};

describe("OmenAgentINFT ERC-7857 interface", () => {
  it("exposes the expected ERC-7857-compatible surface", () => {
    expect(Array.from(functionNames)).toEqual(
      expect.arrayContaining([
        "verifier",
        "iTransfer",
        "iClone",
        "authorizeUsage",
        "revokeAuthorization",
        "delegateAccess",
        "authorizedUsersOf",
        "intelligentDataOf",
        "encryptedURIOf",
        "updateIntelligence",
        "intelligenceVersionCountOf",
        "intelligenceVersionOf",
        "latestIntelligenceVersionOf",
      ]),
    );
  });

  it("publishes versioned intelligence update events", () => {
    expect(Array.from(eventNames)).toEqual(
      expect.arrayContaining([
        "MintedAgent",
        "IntelligenceUpdated",
        "EncryptedURIUpdated",
        "PublishedSealedKey",
        "Transferred",
        "Cloned",
      ]),
    );
  });

  it("returns complete intelligence version records", () => {
    const latestVersion = findFunction("latestIntelligenceVersionOf");
    const output = latestVersion.outputs[0] as
      | {
          type: string;
          components?: Array<{ name: string }>;
        }
      | undefined;

    expect(output?.type).toBe("tuple");
    expect(output?.components?.map((component) => component.name)).toEqual([
      "version",
      "runId",
      "encryptedURI",
      "encryptedDataHash",
      "memoryRootHash",
      "proofManifestHash",
      "updatedAt",
      "blockNumber",
    ]);
  });

  it("requires transfer validity proofs for iTransfer and iClone", () => {
    const iTransfer = findFunction("iTransfer");
    const iClone = findFunction("iClone");

    expect(iTransfer.inputs.at(-1)?.type).toBe("tuple[]");
    expect(iTransfer.inputs.at(-1)?.internalType).toBe("struct TransferValidityProof[]");
    expect(iClone.inputs.at(-1)?.type).toBe("tuple[]");
    expect(iClone.inputs.at(-1)?.internalType).toBe("struct TransferValidityProof[]");
  });

  it("keeps plain transferFrom disabled in the Solidity implementation", async () => {
    const source = await readFile(
      path.resolve(process.cwd(), "../../contracts/OmenAgentINFT.sol"),
      "utf8",
    );

    expect(source).toContain('revert("USE_ITRANSFER")');
  });
});
