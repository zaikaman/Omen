import { randomUUID } from "node:crypto";

import { Client } from "@gradio/client";
import {
  createSupabaseServiceRoleClient,
  type OmenSupabaseClient,
} from "@omen/db";
import sharp from "sharp";

import type { BackendEnv } from "../bootstrap/env.js";
import type { Logger } from "../bootstrap/logger.js";
import { R2StorageService } from "./r2-storage-service.js";

type ImageFile = {
  url?: string;
  path?: string;
};

type GalleryItem = {
  image?: ImageFile;
  caption?: string | null;
};

const DEFAULT_SPACE = "Tongyi-MAI/Z-Image-Turbo";
const DEFAULT_RESOLUTION = "2048x1152 ( 16:9 )";
const TARGET_IMAGE_WIDTH = 2048;
const TARGET_IMAGE_HEIGHT = 1152;
const HF_TOKEN_ROTATION_SOURCE = "hf_token_rotation";
const NO_TEXT_IMAGE_CONSTRAINT =
  "no readable text, no pseudo-readable text, no words, no letters, no numbers, no captions, no labels, no watermarks, no signatures, no ticker symbols, no logos containing text";

type HfTokenRotationSnapshotRow = {
  metadata: Record<string, unknown> | null;
};

class HfTokenRotationCursorStore {
  constructor(
    private readonly input: {
      client: OmenSupabaseClient;
    },
  ) {}

  async reserveNextStartIndex(tokenCount: number) {
    if (tokenCount <= 0) {
      return 0;
    }

    const startIndex = await this.readNextTokenIndex(tokenCount);
    const nextTokenIndex = (startIndex + 1) % tokenCount;

    await this.writeNextTokenIndex({
      nextTokenIndex,
      tokenCount,
      reservedStartIndex: startIndex,
    });

    return startIndex;
  }

  private async readNextTokenIndex(tokenCount: number) {
    const { data, error } = await this.input.client
      .from("service_registry_snapshots")
      .select("metadata")
      .eq("source", HF_TOKEN_ROTATION_SOURCE)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle<HfTokenRotationSnapshotRow>();

    if (error) {
      throw new Error(`Failed to read HuggingFace token cursor: ${error.message}`);
    }

    const rawIndex = data?.metadata?.nextTokenIndex;

    if (typeof rawIndex !== "number" || !Number.isInteger(rawIndex) || rawIndex < 0) {
      return 0;
    }

    return rawIndex % tokenCount;
  }

  private async writeNextTokenIndex(input: {
    nextTokenIndex: number;
    tokenCount: number;
    reservedStartIndex: number;
  }) {
    const insertRow = {
      source: HF_TOKEN_ROTATION_SOURCE,
      peers: [],
      services: [],
      routes: [],
      metadata: {
        nextTokenIndex: input.nextTokenIndex,
        reservedStartIndex: input.reservedStartIndex,
        tokenCount: input.tokenCount,
        updatedAt: new Date().toISOString(),
      },
    };

    const { error } = await this.input.client
      .from("service_registry_snapshots")
      .insert(insertRow as never);

    if (error) {
      throw new Error(`Failed to persist HuggingFace token cursor: ${error.message}`);
    }
  }
}

export const hasIntelImageConfig = (env: BackendEnv) =>
  Boolean(env.r2.accountId && env.r2.accessKeyId && env.r2.secretAccessKey && env.r2.publicUrl);

export class IntelImageService {
  private static hfTokenReservationLock: Promise<void> = Promise.resolve();

  private readonly storage: R2StorageService;
  private readonly hfTokens: string[];
  private readonly hfTokenCursorStore: HfTokenRotationCursorStore | null;

  constructor(
    private readonly input: {
      env: BackendEnv;
      logger: Logger;
    },
  ) {
    this.storage = new R2StorageService({ env: input.env });
    this.hfTokens = this.normalizeHfTokens(input.env);
    this.hfTokenCursorStore = this.createHfTokenCursorStore(input.env);
  }

  async generateAndStore(prompt: string): Promise<string | null> {
    try {
      const temporaryUrl = await this.generateTemporaryImage(this.withNoTextConstraint(prompt));

      if (temporaryUrl === null) {
        return null;
      }

      return await this.downloadAsWebpAndUpload(temporaryUrl);
    } catch (error) {
      this.input.logger.warn("Intel image generation failed.", error);
      return null;
    }
  }

  private async generateTemporaryImage(prompt: string) {
    const tokens = await this.getTokenAttemptOrder();
    let lastError: unknown = null;

    for (const token of tokens) {
      try {
        const client = await Client.connect(DEFAULT_SPACE, {
          token: token as `hf_${string}` | undefined,
        });
        const result = await client.predict("/generate", {
          prompt,
          resolution: DEFAULT_RESOLUTION,
          seed: -1,
          steps: 8,
          shift: 3,
          random_seed: true,
          gallery_images: [],
        });
        const data = result.data as unknown;
        const gallery = Array.isArray(data) ? (data[0] as GalleryItem[] | undefined) : undefined;
        const temporaryUrl = gallery?.[0]?.image?.url ?? gallery?.[0]?.image?.path ?? null;

        if (!temporaryUrl) {
          throw new Error("HuggingFace image response did not include an image URL.");
        }

        return temporaryUrl;
      } catch (error) {
        lastError = error;
        this.input.logger.warn(
          "HuggingFace image generation attempt failed; trying next token.",
          this.describeHfToken(token),
          error,
        );
      }
    }

    if (lastError !== null) {
      throw lastError;
    }

    return null;
  }

  private withNoTextConstraint(prompt: string) {
    return [prompt.trim(), NO_TEXT_IMAGE_CONSTRAINT].filter(Boolean).join(", ");
  }

  private async getTokenAttemptOrder() {
    if (this.hfTokens.length === 0) {
      return [null];
    }

    const startIndex = await this.reserveHfTokenStartIndex();

    return this.hfTokens.map((_, offset) => {
      const index = (startIndex + offset) % this.hfTokens.length;
      return this.hfTokens[index] ?? null;
    });
  }

  private normalizeHfTokens(env: BackendEnv) {
    const tokens = new Set<string>();

    for (const token of env.providers.hfTokens) {
      if (token.trim()) {
        tokens.add(token);
      }
    }

    if (env.providers.hfToken?.trim()) {
      tokens.add(env.providers.hfToken);
    }

    return [...tokens];
  }

  private createHfTokenCursorStore(env: BackendEnv) {
    if (!env.supabase.url || !env.supabase.serviceRoleKey) {
      return null;
    }

    const client = createSupabaseServiceRoleClient({
      url: env.supabase.url,
      anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey,
      serviceRoleKey: env.supabase.serviceRoleKey,
      schema: env.supabase.schema,
    });

    return new HfTokenRotationCursorStore({
      client,
    });
  }

  private requireHfTokenCursorStore() {
    if (this.hfTokenCursorStore === null) {
      throw new Error("HuggingFace token rotation requires configured Supabase persistence.");
    }

    return this.hfTokenCursorStore;
  }

  private async reserveHfTokenStartIndex() {
    const store = this.requireHfTokenCursorStore();
    const reservation = IntelImageService.hfTokenReservationLock.then(() =>
      store.reserveNextStartIndex(this.hfTokens.length),
    );

    IntelImageService.hfTokenReservationLock = reservation.then(
      () => undefined,
      () => undefined,
    );

    return reservation;
  }

  private describeHfToken(token: string | null) {
    if (token === null) {
      return { token: "anonymous" };
    }

    return {
      token: `${token.slice(0, 5)}...${token.slice(-4)}`,
    };
  }

  private async downloadAsWebpAndUpload(temporaryUrl: string) {
    const response = await fetch(temporaryUrl);

    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.status.toString()}`);
    }

    const sourceBuffer = Buffer.from(await response.arrayBuffer());
    const webpBuffer = await sharp(sourceBuffer)
      .resize(TARGET_IMAGE_WIDTH, TARGET_IMAGE_HEIGHT, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .webp({ quality: 86 })
      .toBuffer();
    const datePath = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const key = `intel/${datePath}/${randomUUID()}.webp`;

    return this.storage.uploadFile({
      buffer: webpBuffer,
      key,
      contentType: "image/webp",
    });
  }
}
