export interface EntityRepository<TEntity, TKey> {
  get(id: TKey): Promise<TEntity | undefined>;
  getAll(): Promise<TEntity[]>;
  save(entity: TEntity): Promise<void>;
  saveMany(entities: readonly TEntity[]): Promise<void>;
  remove(id: TKey): Promise<void>;
}
