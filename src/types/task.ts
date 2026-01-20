/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'archived' | 'skipped';

/**
 * 任务优先级
 */
export type TaskPriority = 'high' | 'medium' | 'low';

/**
 * 重复规则频率
 */
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

/**
 * 重复规则结束类型
 */
export type RecurrenceEndType = 'never' | 'count' | 'date';

/**
 * 重复规则
 */
export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number; // 间隔（如：每3天）
  byWeekday?: number[]; // 星期几（0=周日，1=周一...）
  byMonthDay?: number[]; // 每月几号
  byWeek?: number[]; // 第几周
  endType: RecurrenceEndType;
  endCount?: number; // 重复次数
  endDate?: Date; // 结束日期
  excludeDates?: Date[]; // 排除的日期
}

/**
 * 同步状态
 */
export type SyncStatus = 'synced' | 'pending' | 'conflict';

/**
 * 任务实体
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority | null;
  tags: string[];
  category: string | null;
  startDate: Date | null;
  startTime: string | null;
  deadline: Date | null;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRule | null;
  recurrenceEndDate: Date | null;
  recurrenceCount: number | null;
  parentTaskId: string | null; // 用于子任务
  projectId: string | null; // 关联计划
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: SyncStatus;
}

/**
 * 创建任务DTO
 */
export interface CreateTaskDto {
  title: string;
  description?: string;
  priority?: TaskPriority;
  tags?: string[];
  category?: string | null;
  startDate?: Date | null;
  startTime?: string | null;
  deadline?: Date | null;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule | null;
  recurrenceEndDate?: Date | null;
  recurrenceCount?: number | null;
  parentTaskId?: string | null;
  projectId?: string | null;
}

/**
 * 更新任务DTO
 */
export interface UpdateTaskDto extends Partial<CreateTaskDto> {
  status?: TaskStatus;
}

