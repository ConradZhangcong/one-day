import type { OneDayRepositories, UnitOfWork } from '../../application/repositories';

import type { OneDayDatabase } from './database';
import { createDexieRepositories } from './repositories';

export class DexieUnitOfWork implements UnitOfWork {
  readonly repositories: OneDayRepositories;

  constructor(private readonly db: OneDayDatabase) {
    this.repositories = createDexieRepositories(db);
  }

  write<TResult>(
    operation: (repositories: OneDayRepositories) => Promise<TResult> | TResult,
  ): Promise<TResult> {
    return this.db.transaction('rw', this.db.tables, () => operation(this.repositories));
  }
}
