import type { Intel, MetricPoint, Signal } from "@omen/shared";

type TokenFrequencyInput = {
  signals: Signal[];
  intels: Intel[];
  limit?: number;
};

const normalizeTokenLabel = (value: string | null | undefined) =>
  value?.trim().toUpperCase() ?? "";

const sortMetricPoints = (left: MetricPoint, right: MetricPoint) => {
  if (right.value !== left.value) {
    return right.value - left.value;
  }

  return left.label.localeCompare(right.label);
};

export const projectTokenFrequency = (
  input: TokenFrequencyInput,
): MetricPoint[] => {
  const counts = new Map<string, number>();

  for (const signal of input.signals) {
    const label = normalizeTokenLabel(signal.asset);

    if (!label) {
      continue;
    }

    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  for (const intel of input.intels) {
    const uniqueSymbols = new Set(
      intel.symbols.map((symbol) => normalizeTokenLabel(symbol)).filter(Boolean),
    );

    for (const label of uniqueSymbols) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort(sortMetricPoints)
    .slice(0, input.limit ?? 10);
};

export const projectMindshareSummary = (
  tokenFrequency: MetricPoint[],
  limit = 5,
): MetricPoint[] => {
  const topTokens = tokenFrequency.slice(0, limit);
  const total = topTokens.reduce((sum, point) => sum + point.value, 0);

  if (total === 0) {
    return [];
  }

  return topTokens.map((point) => ({
    label: point.label,
    value: Math.round((point.value / total) * 100),
  }));
};
