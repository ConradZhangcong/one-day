import { useLiveQuery } from 'dexie-react-hooks';

import { getApplicationServices } from '@/app/application';
import { useApplicationRevision } from '@/app/application-change';

/** Dexie tracks the repository reads performed by the service and reruns this query after commits. */
export function useTodoSnapshot() {
  const revision = useApplicationRevision();
  return useLiveQuery(async () => {
    const services = await getApplicationServices();
    return services.todos.snapshot();
  }, [revision]);
}
