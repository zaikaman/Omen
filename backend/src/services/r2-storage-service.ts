import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

import type { BackendEnv } from "../bootstrap/env.js";

export class R2StorageService {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(input: { env: BackendEnv }) {
    const { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl } =
      input.env.r2;

    if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
      throw new Error("R2 image storage is not configured.");
    }

    this.bucketName = bucketName;
    this.publicUrl = publicUrl.replace(/\/$/, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadFile(input: {
    buffer: Buffer;
    key: string;
    contentType: string;
  }): Promise<string> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucketName,
        Key: input.key,
        Body: input.buffer,
        ContentType: input.contentType,
        CacheControl: "public, max-age=31536000",
      },
    });

    await upload.done();
    return `${this.publicUrl}/${input.key}`;
  }
}
