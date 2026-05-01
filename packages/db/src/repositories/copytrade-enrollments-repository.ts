import { err, ok, type Result } from "@omen/shared";

import { BaseRepository, type RepositoryError } from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";
import { normalizeDatabaseTimestamp } from "./timestamp.js";

export type CopytradeEnrollmentStatus =
  | "pending_approval"
  | "active"
  | "paused"
  | "revoked"
  | "approval_failed";

export type CopytradeRiskSettings = {
  maxAllocationUsd: number;
  riskPerSignalPercent: number;
  maxLeverage: number;
  maxOpenPositions: number;
  allowedAssets: string[];
  copyLongs: boolean;
  copyShorts: boolean;
};

export type CopytradeEnrollment = {
  id: string;
  walletAddress: string;
  hyperliquidChain: "Mainnet" | "Testnet";
  signatureChainId: `0x${string}`;
  agentAddress: `0x${string}`;
  agentName: string;
  encryptedAgentPrivateKey: string;
  riskSettings: CopytradeRiskSettings;
  status: CopytradeEnrollmentStatus;
  approvalNonce: number;
  approvalResponse: unknown;
  lastError: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CopytradeEnrollmentRow = {
  id: string;
  wallet_address: string;
  hyperliquid_chain: "Mainnet" | "Testnet";
  signature_chain_id: `0x${string}`;
  agent_address: `0x${string}`;
  agent_name: string;
  encrypted_agent_private_key: string;
  risk_settings: CopytradeRiskSettings;
  status: CopytradeEnrollmentStatus;
  approval_nonce: number;
  approval_response: unknown;
  last_error: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type CopytradeEnrollmentInsert = Omit<
  CopytradeEnrollmentRow,
  "id" | "created_at" | "updated_at" | "approved_at" | "approval_response" | "last_error"
> & {
  id?: string;
  approval_response?: unknown;
  last_error?: string | null;
  approved_at?: string | null;
};

type CopytradeEnrollmentUpdate = Partial<CopytradeEnrollmentInsert> & {
  updated_at?: string;
};

const toEnrollment = (row: CopytradeEnrollmentRow): CopytradeEnrollment => ({
  id: row.id,
  walletAddress: row.wallet_address,
  hyperliquidChain: row.hyperliquid_chain,
  signatureChainId: row.signature_chain_id,
  agentAddress: row.agent_address,
  agentName: row.agent_name,
  encryptedAgentPrivateKey: row.encrypted_agent_private_key,
  riskSettings: row.risk_settings,
  status: row.status,
  approvalNonce: row.approval_nonce,
  approvalResponse: row.approval_response,
  lastError: row.last_error,
  approvedAt: normalizeDatabaseTimestamp(row.approved_at),
  createdAt: normalizeDatabaseTimestamp(row.created_at) ?? row.created_at,
  updatedAt: normalizeDatabaseTimestamp(row.updated_at) ?? row.updated_at,
});

const toInsertRow = (
  enrollment: Omit<
    CopytradeEnrollment,
    "id" | "createdAt" | "updatedAt" | "approvedAt" | "approvalResponse" | "lastError"
  >,
): CopytradeEnrollmentInsert => ({
  wallet_address: enrollment.walletAddress,
  hyperliquid_chain: enrollment.hyperliquidChain,
  signature_chain_id: enrollment.signatureChainId,
  agent_address: enrollment.agentAddress,
  agent_name: enrollment.agentName,
  encrypted_agent_private_key: enrollment.encryptedAgentPrivateKey,
  risk_settings: enrollment.riskSettings,
  status: enrollment.status,
  approval_nonce: enrollment.approvalNonce,
});

export class CopytradeEnrollmentsRepository extends BaseRepository<
  CopytradeEnrollmentRow,
  CopytradeEnrollmentInsert,
  CopytradeEnrollmentUpdate
> {
  constructor(client: OmenSupabaseClient) {
    super(client, "copytrade_enrollments");
  }

  async createEnrollment(
    enrollment: Omit<
      CopytradeEnrollment,
      "id" | "createdAt" | "updatedAt" | "approvedAt" | "approvalResponse" | "lastError"
    >,
  ): Promise<Result<CopytradeEnrollment, RepositoryError>> {
    const inserted = await this.insertOne(toInsertRow(enrollment));

    if (!inserted.ok) {
      return inserted;
    }

    return ok(toEnrollment(inserted.value));
  }

  async findLatestByWallet(
    walletAddress: string,
  ): Promise<Result<CopytradeEnrollment | null, RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("wallet_address", walletAddress.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<CopytradeEnrollmentRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toEnrollment(data) : null);
  }

  async listActive(limit = 250): Promise<Result<CopytradeEnrollment[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(limit)
      .returns<CopytradeEnrollmentRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toEnrollment(row)));
  }

  async updateEnrollment(
    enrollmentId: string,
    patch: CopytradeEnrollmentUpdate,
  ): Promise<Result<CopytradeEnrollment, RepositoryError>> {
    const updated = await this.updateById(enrollmentId, {
      ...patch,
      updated_at: new Date().toISOString(),
    });

    if (!updated.ok) {
      return updated;
    }

    return ok(toEnrollment(updated.value));
  }
}
