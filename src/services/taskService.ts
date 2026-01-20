import { taskRepository } from '@/db/taskRepository';
import type { Task, CreateTaskDto, UpdateTaskDto } from '@/types/task';

/**
 * 任务服务类
 */
export class TaskService {
  /**
   * 创建任务
   */
  async createTask(dto: CreateTaskDto): Promise<Task> {
    return taskRepository.create(dto);
  }

  /**
   * 获取任务
   */
  async getTask(id: string): Promise<Task | undefined> {
    return taskRepository.getById(id);
  }

  /**
   * 获取所有任务
   */
  async getAllTasks(): Promise<Task[]> {
    return taskRepository.getAll();
  }

  /**
   * 更新任务
   */
  async updateTask(id: string, dto: UpdateTaskDto): Promise<Task | undefined> {
    return taskRepository.update(id, dto);
  }

  /**
   * 删除任务
   */
  async deleteTask(id: string): Promise<boolean> {
    return taskRepository.delete(id);
  }

  /**
   * 完成任务
   */
  async completeTask(id: string): Promise<Task | undefined> {
    return taskRepository.update(id, {
      status: 'completed',
      completedAt: new Date(),
    });
  }

  /**
   * 归档任务
   */
  async archiveTask(id: string): Promise<Task | undefined> {
    return taskRepository.update(id, {
      status: 'archived',
    });
  }

  /**
   * 取消归档任务
   */
  async unarchiveTask(id: string): Promise<Task | undefined> {
    return taskRepository.update(id, {
      status: 'completed',
    });
  }
}

export const taskService = new TaskService();

