export const RUNTIME_MODE_VALUES = [
  "mocked",
  "live",
  "production_like",
] as const;

export type RuntimeMode = (typeof RUNTIME_MODE_VALUES)[number];

export type RuntimeModeFlags = {
  mode: RuntimeMode;
  usesMockData: boolean;
  allowsExternalReads: boolean;
  allowsExternalWrites: boolean;
  label: string;
};

export const isRuntimeMode = (value: string | undefined): value is RuntimeMode =>
  value !== undefined &&
  (RUNTIME_MODE_VALUES as readonly string[]).includes(value);

export const normalizeRuntimeMode = (value: string | undefined): RuntimeMode => {
  if (isRuntimeMode(value)) {
    return value;
  }

  return "mocked";
};

export const getRuntimeModeFlags = (mode: RuntimeMode): RuntimeModeFlags => {
  switch (mode) {
    case "live":
      return {
        mode,
        usesMockData: false,
        allowsExternalReads: true,
        allowsExternalWrites: true,
        label: "Live",
      };
    case "production_like":
      return {
        mode,
        usesMockData: false,
        allowsExternalReads: true,
        allowsExternalWrites: false,
        label: "Production-like",
      };
    case "mocked":
    default:
      return {
        mode: "mocked",
        usesMockData: true,
        allowsExternalReads: false,
        allowsExternalWrites: false,
        label: "Mocked demo",
      };
  }
};
