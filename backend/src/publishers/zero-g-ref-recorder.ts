import type { ProofArtifact, Result } from "@omen/shared";
import type { ZeroGRefsRepository, RepositoryError } from "@omen/db";

export class ZeroGRefRecorder {
  constructor(
    private readonly repository: ZeroGRefsRepository,
  ) {}

  async recordArtifact(
    artifact: ProofArtifact,
  ): Promise<Result<ProofArtifact, RepositoryError>> {
    return this.repository.createRef(artifact);
  }

  async recordArtifacts(
    artifacts: ProofArtifact[],
  ): Promise<Result<ProofArtifact[], RepositoryError>> {
    const recorded: ProofArtifact[] = [];

    for (const artifact of artifacts) {
      const result = await this.recordArtifact(artifact);

      if (!result.ok) {
        return result;
      }

      recorded.push(result.value);
    }

    return {
      ok: true,
      value: recorded,
    };
  }
}
