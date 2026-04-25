export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type Nullable<T> = T | null;

export type ValueOf<T> = T[keyof T];
