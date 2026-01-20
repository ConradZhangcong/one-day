import { db } from './database';
import type { Task, CreateTaskDto, UpdateTaskDto } from '@/types/task';

/**
 * 任务仓库类
 */
export class TaskRepository {
  /**
   * 创建任务
   */
  async create(dto: CreateTaskDto): Promise<Task> {
    const now = new Date();
    const task: Task = {
      id: crypto.randomUUID(),
      title: dto.title,
      description: dto.description || '',
      type: dto.type || 'single',
      status: 'pending',
      priority: dto.priority || null,
      tags: dto.tags || [],
      category: dto.category || null,
      startDate: dto.startDate || null,
      startTime: dto.startTime || null,
      deadline: dto.deadline || null,
      endDate: dto.endDate || null,
      recurrenceRule: dto.recurrenceRule || null,
      recurrenceEndDate: dto.recurrenceEndDate || null,
      recurrenceCount: dto.recurrenceCount || null,
      parentTaskId: dto.parentTaskId || null,
      progress: dto.progress || 0,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    await db.tasks.add(task);
    return task;
  }

  /**
   * 根据ID获取任务
   */
  async getById(id: string): Promise<Task | undefined> {
    return db.tasks.get(id);
  }

  /**
   * 获取所有任务
   */
  async getAll(): Promise<Task[]> {
    return db.tasks.toArray();
  }

  /**
   * 更新任务
   */
  async update(id: string, dto: UpdateTaskDto): Promise<Task | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    const updated: Task = {
      ...task,
      ...dto,
      updatedAt: new Date(),
      syncStatus: 'pending',
    };

    await db.tasks.update(id, updated);
    return updated;
  }

  /**
   * 删除任务
   */
  async delete(id: string): Promise<boolean> {
    await db.tasks.delete(id);
    const task = await this.getById(id);
    return task === undefined;
  }

  /**
   * 根据状态查询任务
   */
  async getByStatus(status: Task['status']): Promise<Task[]> {
    return db.tasks.where('status').equals(status).toArray();
  }

  /**
   * 根据日期范围查询任务
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<Task[]> {
    return db.tasks
      .where('startDate')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  /**
   * 根据父任务ID查询子任务
   */
  async getByParentTaskId(parentTaskId: string): Promise<Task[]> {
    return db.tasks.where('parentTaskId').equals(parentTaskId).toArray();
  }

  /**
   * 根据任务类型查询任务
   */
  async getByType(type: Task['type']): Promise<Task[]> {
    return db.tasks.where('type').equals(type).toArray();
  }
}

export const taskRepository = new TaskRepository();

