import { randomUUID } from "node:crypto";

import { Client } from "@gradio/client";
import sharp from "sharp";

import type { BackendEnv } from "../bootstrap/env";
import type { Logger } from "../bootstrap/logger";
import { R2StorageService } from "./r2-storage-service";

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
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const hasIntelImageConfig = (env: BackendEnv) =>
  Boolean(
    env.r2.accountId &&
      env.r2.accessKeyId &&
      env.r2.secretAccessKey &&
      env.r2.publicUrl,
  );

export class IntelImageService {
  private readonly storage: R2StorageService;
  private readonly hfToken: string | null;

  constructor(
    private readonly input: {
      env: BackendEnv;
      logger: Logger;
    },
  ) {
    this.storage = new R2StorageService({ env: input.env });
    this.hfToken = input.env.providers.hfToken;
  }

  async generateAndStore(prompt: string): Promise<string | null> {
    try {
      const client = await this.connectWithRetry();
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
        this.input.logger.warn("HuggingFace image response did not include an image URL.");
        return null;
      }

      return await this.downloadAsWebpAndUpload(temporaryUrl);
    } catch (error) {
      this.input.logger.warn("Intel image generation failed.", error);
      return null;
    }
  }

  private async connectWithRetry() {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await Client.connect(DEFAULT_SPACE, {
          token: this.hfToken as `hf_${string}` | undefined,
        });
      } catch (error) {
        lastError = error;

        if (attempt < MAX_RETRIES) {
          await sleep(INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1));
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to connect to HuggingFace image space.");
  }

  private async downloadAsWebpAndUpload(temporaryUrl: string) {
    const response = await fetch(temporaryUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to download generated image: ${response.status.toString()}`,
      );
    }

    const sourceBuffer = Buffer.from(await response.arrayBuffer());
    const webpBuffer = await sharp(sourceBuffer)
      .resize(2048, 1152, { fit: "cover" })
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
