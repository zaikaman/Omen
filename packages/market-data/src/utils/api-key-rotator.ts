export class ApiKeyRotator {
  private currentIndex = 0;

  private readonly keys: string[];

  constructor(keys: Array<string | undefined>) {
    this.keys = keys.map((key) => key?.trim()).filter((key): key is string => !!key);
  }

  get size() {
    return this.keys.length;
  }

  next() {
    if (this.keys.length === 0) {
      return undefined;
    }

    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }
}

export const resolveNumberedApiKeys = (baseName: string, maxKeys = 10) => {
  const keys = [process.env[baseName]];

  for (let index = 1; index <= maxKeys; index += 1) {
    keys.push(process.env[`${baseName}_${index.toString()}`]);
  }

  return keys.map((key) => key?.trim()).filter((key): key is string => !!key);
};
