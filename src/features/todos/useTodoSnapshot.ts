import { useLiveQuery } from 'dexie-react-hooks';

import { getApplicationServices } from '@/app/application';
import { useApplicationRevision } from '@/app/application-change';

/** Reload the account snapshot when the server revision changes. */
export function useTodoSnapshot() {
  const revision = useApplicationRevision();
  return useLiveQuery(async () => {
    const services = await getApplicationServices();
    return services.todos.snapshot();
  }, [revision]);
}
