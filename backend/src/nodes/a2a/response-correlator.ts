import {
  analystOutputSchema,
  criticOutputSchema,
  researchOutputSchema,
  scannerOutputSchema,
  type AnalystOutput,
  type CriticOutput,
  type ResearchOutput,
  type ScannerOutput,
} from "@omen/agents";
import {
  err,
  ok,
  type AxlA2ADelegationEnvelope,
  type AxlA2AResult,
  type Result,
} from "@omen/shared";

type SpecialistRole = "scanner" | "research" | "analyst" | "critic";

type SpecialistOutputMap = {
  scanner: ScannerOutput;
  research: ResearchOutput;
  analyst: AnalystOutput;
  critic: CriticOutput;
};

export type CorrelatedDelegationResult<TOutput> = {
  request: AxlA2ADelegationEnvelope["request"];
  receipt: AxlA2ADelegationEnvelope["receipt"];
  result: AxlA2AResult;
  output: TOutput;
};

export class A2AResponseCorrelator {
  correlateScanner(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("scanner", envelope, scannerOutputSchema);
  }

  correlateResearch(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("research", envelope, researchOutputSchema);
  }

  correlateAnalyst(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("analyst", envelope, analystOutputSchema);
  }

  correlateCritic(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("critic", envelope, criticOutputSchema);
  }

  private correlate<TRole extends SpecialistRole>(
    expectedRole: TRole,
    envelope: AxlA2ADelegationEnvelope,
    schema: { parse: (input: unknown) => SpecialistOutputMap[TRole] },
  ): Result<CorrelatedDelegationResult<SpecialistOutputMap[TRole]>, Error> {
    if (envelope.request.requestedRole !== expectedRole) {
      return err(
        new Error(
          `Expected A2A response for ${expectedRole}, received ${envelope.request.requestedRole}.`,
        ),
      );
    }

    if (envelope.result === null) {
      return err(
        new Error(`A2A delegation ${envelope.request.delegationId} has no result payload.`),
      );
    }

    if (envelope.result.responderRole !== expectedRole) {
      return err(
        new Error(
          `A2A responder role ${envelope.result.responderRole} does not match expected ${expectedRole}.`,
        ),
      );
    }

    if (envelope.result.state !== "completed") {
      return err(
        new Error(
          envelope.result.error ??
            `A2A delegation ${envelope.request.delegationId} ended in ${envelope.result.state}.`,
        ),
      );
    }

    try {
      const output = schema.parse(envelope.result.output);

      return ok({
        request: envelope.request,
        receipt: envelope.receipt,
        result: envelope.result,
        output,
      });
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error("Failed to correlate A2A delegation output."),
      );
    }
  }
}
