import type { LongTermGoal, SingleTask } from '../../domain';
import type { OneDayRepositories } from '../repositories';

/** Retains the legacy goalId wire field while references now point to tasks. */
export function taskParentReference(task: SingleTask): LongTermGoal {
  return {
    id: task.id,
    title: task.title,
    description: task.notes,
    status: task.state === 'completed' ? 'completed' : task.paused ? 'planned' : 'active',
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function findTaskParent(repositories: OneDayRepositories, id: string) {
  const [task, legacy] = await Promise.all([
    repositories.singleTasks.get(id),
    repositories.longTermGoals.get(id),
  ]);
  return task ? taskParentReference(task) : legacy;
}
