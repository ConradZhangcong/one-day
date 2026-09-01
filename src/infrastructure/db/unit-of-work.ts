import type { OneDayRepositories, UnitOfWork } from '../../application/repositories';

import type { OneDayDatabase } from './database';
import { createDexieRepositories } from './repositories';

export class DexieUnitOfWork implements UnitOfWork {
  readonly repositories: OneDayRepositories;

  constructor(
    private readonly db: OneDayDatabase,
    private readonly onCommitted: () => void = () => undefined,
  ) {
    this.repositories = createDexieRepositories(db);
  }

  async write<TResult>(
    operation: (repositories: OneDayRepositories) => Promise<TResult> | TResult,
  ): Promise<TResult> {
    const result = await this.db.transaction('rw', this.db.tables, () =>
      operation(this.repositories),
    );
    this.onCommitted();
    return result;
  }
}
