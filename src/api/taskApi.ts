import { apiClient } from './client';
import type { Task, CreateTaskDto, UpdateTaskDto } from '@/types/task';

/**
 * 任务API
 */
export const taskApi = {
  /**
   * 获取任务列表
   */
  async getTasks(params?: {
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Task[]> {
    return apiClient.get<Task[]>('/tasks', params);
  },

  /**
   * 获取单个任务
   */
  async getTask(id: string): Promise<Task> {
    return apiClient.get<Task>(`/tasks/${id}`);
  },

  /**
   * 创建任务
   */
  async createTask(dto: CreateTaskDto): Promise<Task> {
    return apiClient.post<Task>('/tasks', dto);
  },

  /**
   * 更新任务
   */
  async updateTask(id: string, dto: UpdateTaskDto): Promise<Task> {
    return apiClient.put<Task>(`/tasks/${id}`, dto);
  },

  /**
   * 删除任务
   */
  async deleteTask(id: string): Promise<void> {
    return apiClient.delete<void>(`/tasks/${id}`);
  },
};

