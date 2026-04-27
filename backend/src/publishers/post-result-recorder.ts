import type { OutboundPost, Run } from "@omen/shared";
import type {
  AnalyticsSnapshotsRepository,
  RunsRepository,
} from "@omen/db";

export class PostResultRecorder {
  constructor(
    private readonly input: {
      runs?: RunsRepository | null;
      analytics?: AnalyticsSnapshotsRepository | null;
    },
  ) {}

  async recordPostResult(input: {
    run: Run;
    post: OutboundPost;
  }) {
    if (this.input.runs) {
      const outcome = input.run.outcome
        ? {
            ...input.run.outcome,
            postId: input.post.id,
            postStatus: input.post.status,
            publishedUrl: input.post.publishedUrl,
          }
        : null;

      await this.input.runs.updateRun(input.run.id, {
        outcome,
        updatedAt: input.post.updatedAt,
      });
    }
  }

}
