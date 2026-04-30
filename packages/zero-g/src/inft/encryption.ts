import { createCipheriv, createHash, publicEncrypt, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import { getBytes, hexlify, keccak256 } from "ethers";

const textEncoder = new TextEncoder();

export type EncryptedInftPayload = {
  encryptedBytes: Uint8Array;
  encryption: {
    algorithm: "AES-256-GCM";
    iv: string;
    authTag: string;
    sealedKey: string;
    sealedKeyAlgorithm: "RSA-OAEP-SHA256";
    plaintextSha256: string;
    ciphertextSha256: string;
    ciphertextKeccak256: string;
  };
};

export const sha256Hex = (bytes: Uint8Array | string) => {
  const hash = createHash("sha256");

  hash.update(typeof bytes === "string" ? textEncoder.encode(bytes) : bytes);

  return `sha256:${hash.digest("hex")}`;
};

export const keccak256Utf8 = (value: string) => keccak256(textEncoder.encode(value));

export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`)
    .join(",")}}`;
};

export const loadPublicKeyPem = async (input: {
  publicKeyPem?: string | null;
  publicKeyPath?: string | null;
}) => {
  if (input.publicKeyPem?.trim()) {
    return input.publicKeyPem.trim().replace(/\\n/g, "\n");
  }

  if (input.publicKeyPath?.trim()) {
    return readFile(input.publicKeyPath.trim(), "utf8");
  }

  throw new Error(
    "OMEN_INFT_OWNER_PUBLIC_KEY_PEM or OMEN_INFT_OWNER_PUBLIC_KEY_PATH is required.",
  );
};

export const encryptInftPayload = (input: {
  plaintext: string;
  ownerPublicKeyPem: string;
}): EncryptedInftPayload => {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintextBytes = textEncoder.encode(input.plaintext);
  const encryptedBytes = Buffer.concat([
    cipher.update(plaintextBytes),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const sealedKey = publicEncrypt(
    {
      key: input.ownerPublicKeyPem,
      oaepHash: "sha256",
    },
    key,
  );

  return {
    encryptedBytes,
    encryption: {
      algorithm: "AES-256-GCM",
      iv: hexlify(iv),
      authTag: hexlify(authTag),
      sealedKey: hexlify(sealedKey),
      sealedKeyAlgorithm: "RSA-OAEP-SHA256",
      plaintextSha256: sha256Hex(plaintextBytes),
      ciphertextSha256: sha256Hex(encryptedBytes),
      ciphertextKeccak256: keccak256(getBytes(hexlify(encryptedBytes))),
    },
  };
};
