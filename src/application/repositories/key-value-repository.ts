export interface KeyValueEntry<TValue = unknown> {
  key: string;
  value: TValue;
}

export interface KeyValueRepository {
  get(key: string): Promise<unknown>;
  getAll(): Promise<KeyValueEntry[]>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}
