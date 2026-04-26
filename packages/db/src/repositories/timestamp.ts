export const normalizeDatabaseTimestamp = (
  value: string | null | undefined,
): string | null => {
  if (!value) {
    return value ?? null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return parsed.toISOString();
};
