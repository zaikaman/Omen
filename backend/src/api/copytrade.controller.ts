import { createCipheriv, createHash, randomBytes } from "crypto";
import type { Request, Response } from "express";
import { Wallet } from "ethers";

import {
  CopytradeEnrollmentsRepository,
  createSupabaseServiceRoleClient,
  type CopytradeRiskSettings,
} from "@omen/db";

import type { BackendEnv } from "../bootstrap/env.js";

const HYPERLIQUID_EXCHANGE_URLS: Record<HyperliquidChain, string> = {
  Mainnet: "https://api.hyperliquid.xyz/exchange",
  Testnet: "https://api.hyperliquid-testnet.xyz/exchange",
};
const AGENT_NAME = "OmenCopy";

type HyperliquidChain = "Mainnet" | "Testnet";

const isAddress = (value: unknown): value is `0x${string}` =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

const isHexChainId = (value: unknown): value is `0x${string}` =>
  typeof value === "string" && /^0x[a-fA-F0-9]+$/.test(value);

const createRepository = (env: BackendEnv) => {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    return null;
  }

  const client = createSupabaseServiceRoleClient({
    url: env.supabase.url,
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey,
    serviceRoleKey: env.supabase.serviceRoleKey,
    schema: env.supabase.schema,
  });

  return new CopytradeEnrollmentsRepository(client);
};

const parseRiskSettings = (input: unknown): CopytradeRiskSettings => {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const maxAllocationUsd = Number(value.maxAllocationUsd);
  const riskPerSignalPercent = Number(value.riskPerSignalPercent);
  const maxLeverage = Number(value.maxLeverage);
  const maxOpenPositions = Number(value.maxOpenPositions);
  const allowedAssets = Array.isArray(value.allowedAssets)
    ? value.allowedAssets
        .filter((asset): asset is string => typeof asset === "string")
        .map((asset) => asset.trim().toUpperCase())
        .filter(Boolean)
    : [];

  return {
    maxAllocationUsd: Number.isFinite(maxAllocationUsd) ? Math.max(0, maxAllocationUsd) : 0,
    riskPerSignalPercent: Number.isFinite(riskPerSignalPercent)
      ? Math.min(Math.max(riskPerSignalPercent, 0.1), 10)
      : 1,
    maxLeverage: Number.isFinite(maxLeverage) ? Math.min(Math.max(Math.floor(maxLeverage), 1), 50) : 5,
    maxOpenPositions: Number.isFinite(maxOpenPositions)
      ? Math.min(Math.max(Math.floor(maxOpenPositions), 1), 10)
      : 3,
    allowedAssets,
    copyLongs: value.copyLongs !== false,
    copyShorts: value.copyShorts !== false,
  };
};

const encryptAgentKey = (privateKey: string, encryptionKey: string) => {
  const key = createHash("sha256").update(encryptionKey).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
};

const presentEnrollment = (enrollment: {
  id: string;
  walletAddress: string;
  hyperliquidChain: HyperliquidChain;
  signatureChainId: `0x${string}`;
  agentAddress: `0x${string}`;
  agentName: string;
  riskSettings: CopytradeRiskSettings;
  status: string;
  approvalNonce: number;
  approvalResponse?: unknown;
  lastError?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
}) => ({
  id: enrollment.id,
  walletAddress: enrollment.walletAddress,
  hyperliquidChain: enrollment.hyperliquidChain,
  signatureChainId: enrollment.signatureChainId,
  agentAddress: enrollment.agentAddress,
  agentName: enrollment.agentName,
  riskSettings: enrollment.riskSettings,
  status: enrollment.status,
  approvalNonce: enrollment.approvalNonce,
  approvalResponse: enrollment.approvalResponse,
  lastError: enrollment.lastError ?? null,
  approvedAt: enrollment.approvedAt ?? null,
  createdAt: enrollment.createdAt ?? null,
});

export const createCopytradeStatusController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repository = createRepository(env);
    const walletAddress = typeof req.query.walletAddress === "string"
      ? req.query.walletAddress.toLowerCase()
      : "";

    if (!isAddress(walletAddress)) {
      res.status(400).json({ success: false, error: "A valid walletAddress is required." });
      return;
    }

    if (!repository) {
      res.status(503).json({ success: false, error: "Copytrade persistence is not configured." });
      return;
    }

    const found = await repository.findLatestByWallet(walletAddress);

    if (!found.ok) {
      res.status(500).json({ success: false, error: found.error.message });
      return;
    }

    res.json({ success: true, data: found.value ? presentEnrollment(found.value) : null });
  };

export const createCopytradePrepareController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repository = createRepository(env);

    if (!repository) {
      res.status(503).json({ success: false, error: "Copytrade persistence is not configured." });
      return;
    }

    if (!env.deferred.futuresEncryptionKey) {
      res.status(503).json({
        success: false,
        error: "FUTURES_ENCRYPTION_KEY is required before Omen can store an agent wallet.",
      });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const walletAddress = typeof body.walletAddress === "string"
      ? body.walletAddress.toLowerCase()
      : "";
    const signatureChainId = body.signatureChainId;
    const hyperliquidChain = body.hyperliquidChain === "Testnet" ? "Testnet" : "Mainnet";

    if (!isAddress(walletAddress) || !isHexChainId(signatureChainId)) {
      res.status(400).json({ success: false, error: "Wallet address and signature chain id are required." });
      return;
    }

    const agentWallet = Wallet.createRandom();
    const approvalNonce = Date.now();
    const riskSettings = parseRiskSettings(body.riskSettings);
    const encryptedAgentPrivateKey = encryptAgentKey(
      agentWallet.privateKey,
      env.deferred.futuresEncryptionKey,
    );

    const created = await repository.createEnrollment({
      walletAddress,
      hyperliquidChain,
      signatureChainId,
      agentAddress: agentWallet.address.toLowerCase() as `0x${string}`,
      agentName: AGENT_NAME,
      encryptedAgentPrivateKey,
      riskSettings,
      status: "pending_approval",
      approvalNonce,
    });

    if (!created.ok) {
      res.status(500).json({ success: false, error: created.error.message });
      return;
    }

    res.json({ success: true, data: presentEnrollment(created.value) });
  };

export const createCopytradeFinalizeController =
  (env: BackendEnv) => async (req: Request, res: Response) => {
    const repository = createRepository(env);

    if (!repository) {
      res.status(503).json({ success: false, error: "Copytrade persistence is not configured." });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const enrollmentId = typeof body.enrollmentId === "string" ? body.enrollmentId : "";
    const action = body.action;
    const signature = body.signature;

    if (!enrollmentId || !action || typeof action !== "object" || !signature || typeof signature !== "object") {
      res.status(400).json({ success: false, error: "Enrollment id, action, and signature are required." });
      return;
    }

    const hyperliquidChain =
      (action as { hyperliquidChain?: unknown }).hyperliquidChain === "Testnet"
        ? "Testnet"
        : "Mainnet";

    const exchangeResponse = await fetch(HYPERLIQUID_EXCHANGE_URLS[hyperliquidChain], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        signature,
        nonce: (action as { nonce?: unknown }).nonce,
      }),
    });
    const payload = await exchangeResponse.json().catch(() => null) as unknown;
    const isApproved =
      exchangeResponse.ok &&
      Boolean(payload) &&
      typeof payload === "object" &&
      (payload as { status?: unknown }).status === "ok";

    const updated = await repository.updateEnrollment(enrollmentId, {
      approval_response: payload,
      last_error: isApproved ? null : `Hyperliquid approval failed with status ${exchangeResponse.status.toString()}.`,
      status: isApproved ? "active" : "approval_failed",
      approved_at: isApproved ? new Date().toISOString() : null,
    });

    if (!updated.ok) {
      res.status(500).json({ success: false, error: updated.error.message });
      return;
    }

    if (!isApproved) {
      res.status(502).json({
        success: false,
        error: "Hyperliquid rejected the agent approval.",
        data: presentEnrollment(updated.value),
      });
      return;
    }

    res.json({ success: true, data: presentEnrollment(updated.value) });
  };
