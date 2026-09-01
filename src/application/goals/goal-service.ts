import { Temporal } from 'temporal-polyfill';

import {
  decodeInstant,
  DomainError,
  DomainErrorCode,
  longTermGoalSchema,
  type LongTermGoal,
  type LongTermGoalStatus,
  type SingleTask,
} from '../../domain';
import type { UnitOfWork } from '../repositories';

export interface GoalDraft {
  readonly title: string;
  readonly description: string;
  readonly status: LongTermGoalStatus;
}

export interface GoalProgress {
  readonly goal: LongTermGoal;
  readonly completedTasks: number;
  readonly totalTasks: number;
  readonly percent: number;
  readonly linkedTasks: readonly SingleTask[];
}

export class GoalService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly createId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => Temporal.Now.instant().toString(),
  ) {}

  async snapshot(): Promise<GoalProgress[]> {
    const [goals, tasks] = await Promise.all([
      this.unitOfWork.repositories.longTermGoals.getAll(),
      this.unitOfWork.repositories.singleTasks.getAll(),
    ]);

    return goals
      .map((goal) => {
        const linked = tasks.filter((task) => task.goalId === goal.id);
        const completedTasks = linked.filter((task) => task.state === 'completed').length;
        return {
          goal,
          completedTasks,
          totalTasks: linked.length,
          percent:
            linked.length === 0 ? 0 : Math.round((completedTasks / linked.length) * 100),
          linkedTasks: linked,
        };
      })
      .sort((left, right) => right.goal.updatedAt.localeCompare(left.goal.updatedAt));
  }

  create(draft: GoalDraft): Promise<LongTermGoal> {
    return this.unitOfWork.write(async ({ longTermGoals }) => {
      const instant = decodeInstant(this.now());
      const goal = longTermGoalSchema.parse({
        id: `goal:${this.createId()}`,
        ...draft,
        createdAt: instant,
        updatedAt: instant,
      });
      await longTermGoals.save(goal);
      return goal;
    });
  }

  update(goalId: string, draft: GoalDraft): Promise<LongTermGoal> {
    return this.unitOfWork.write(async ({ longTermGoals }) => {
      const current = await longTermGoals.get(goalId);
      if (current === undefined) {
        throw new DomainError(DomainErrorCode.GOAL_NOT_FOUND, 'Goal does not exist.');
      }
      const updated = longTermGoalSchema.parse({
        ...current,
        ...draft,
        updatedAt: decodeInstant(this.now()),
      });
      await longTermGoals.save(updated);
      return updated;
    });
  }
}
