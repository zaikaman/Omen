import {
  analystOutputSchema,
  chartVisionOutputSchema,
  criticOutputSchema,
  generatorOutputSchema,
  intelOutputSchema,
  marketBiasAgentOutputSchema,
  memoryOutputSchema,
  publisherOutputSchema,
  researchOutputSchema,
  scannerOutputSchema,
  writerOutputSchema,
  type AnalystOutput,
  type ChartVisionOutput,
  type CriticOutput,
  type GeneratorOutput,
  type IntelOutput,
  type MarketBiasAgentOutput,
  type MemoryOutput,
  type PublisherOutput,
  type ResearchOutput,
  type ScannerOutput,
  type WriterOutput,
} from "@omen/agents";
import {
  err,
  ok,
  type AxlA2ADelegationEnvelope,
  type AxlA2AResult,
  type Result,
} from "@omen/shared";

type SpecialistRole =
  | "scanner"
  | "market_bias"
  | "research"
  | "chart_vision"
  | "analyst"
  | "critic"
  | "generator"
  | "intel"
  | "writer"
  | "memory"
  | "publisher";

type SpecialistOutputMap = {
  market_bias: MarketBiasAgentOutput;
  scanner: ScannerOutput;
  research: ResearchOutput;
  chart_vision: ChartVisionOutput;
  analyst: AnalystOutput;
  critic: CriticOutput;
  generator: GeneratorOutput;
  intel: IntelOutput;
  writer: WriterOutput;
  memory: MemoryOutput;
  publisher: PublisherOutput;
};

export type CorrelatedDelegationResult<TOutput> = {
  request: AxlA2ADelegationEnvelope["request"];
  receipt: AxlA2ADelegationEnvelope["receipt"];
  result: AxlA2AResult;
  output: TOutput;
};

export class A2AResponseCorrelator {
  correlateMarketBias(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("market_bias", envelope, marketBiasAgentOutputSchema);
  }

  correlateScanner(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("scanner", envelope, scannerOutputSchema);
  }

  correlateResearch(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("research", envelope, researchOutputSchema);
  }

  correlateAnalyst(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("analyst", envelope, analystOutputSchema);
  }

  correlateChartVision(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("chart_vision", envelope, chartVisionOutputSchema);
  }

  correlateCritic(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("critic", envelope, criticOutputSchema);
  }

  correlateGenerator(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("generator", envelope, generatorOutputSchema);
  }

  correlateIntel(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("intel", envelope, intelOutputSchema);
  }

  correlateWriter(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("writer", envelope, writerOutputSchema);
  }

  correlateMemory(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("memory", envelope, memoryOutputSchema);
  }

  correlatePublisher(envelope: AxlA2ADelegationEnvelope) {
    return this.correlate("publisher", envelope, publisherOutputSchema);
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
        error instanceof Error ? error : new Error("Failed to correlate A2A delegation output."),
      );
    }
  }
}
