import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_VERSION = "v1";

const deriveKey = (encryptionKey: string) =>
  createHash("sha256").update(encryptionKey).digest();

export const encryptAgentKey = (privateKey: string, encryptionKey: string) => {
  const key = deriveKey(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
};

export const decryptAgentKey = (encryptedPrivateKey: string, encryptionKey: string) => {
  const [version, iv, tag, ciphertext] = encryptedPrivateKey.split(".");

  if (version !== ENCRYPTION_VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted agent key format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(encryptionKey),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};
