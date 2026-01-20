import { apiClient } from './client';
import type { Task } from '@/types/task';
import type { Journal } from '@/types/journal';

/**
 * 同步API
 */
export const syncApi = {
  /**
   * 批量同步数据
   */
  async sync(data: {
    tasks?: Task[];
    journals?: Journal[];
  }): Promise<{
    success: boolean;
    syncedTasks: string[];
    syncedJournals: string[];
  }> {
    return apiClient.post('/sync', data);
  },

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<{
    lastSyncTime: Date | null;
    pendingCount: number;
  }> {
    return apiClient.get('/sync/status');
  },
};

