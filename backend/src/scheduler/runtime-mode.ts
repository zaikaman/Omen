export const RUNTIME_MODE_VALUES = [
  "live",
  "production_like",
] as const;

export type RuntimeMode = (typeof RUNTIME_MODE_VALUES)[number];

export type RuntimeModeFlags = {
  mode: RuntimeMode;
  allowsExternalReads: boolean;
  allowsExternalWrites: boolean;
  label: string;
};

export const isRuntimeMode = (value: string | undefined): value is RuntimeMode =>
  value !== undefined &&
  (RUNTIME_MODE_VALUES as readonly string[]).includes(value);

export const normalizeRuntimeMode = (value: string | undefined): RuntimeMode => {
  if (value === "production-like") {
    return "production_like";
  }

  if (isRuntimeMode(value)) {
    return value;
  }

  return "live";
};

export const getRuntimeModeFlags = (mode: RuntimeMode): RuntimeModeFlags => {
  switch (mode) {
    case "live":
      return {
        mode,
        allowsExternalReads: true,
        allowsExternalWrites: true,
        label: "Live",
      };
    case "production_like":
      return {
        mode,
        allowsExternalReads: true,
        allowsExternalWrites: false,
        label: "Production-like",
      };
    default:
      return {
        mode: "live",
        allowsExternalReads: true,
        allowsExternalWrites: true,
        label: "Live",
      };
  }
};
