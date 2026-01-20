import { db } from '@/db/database';
import type { SyncLog } from '@/db/database';

/**
 * 同步服务类
 */
export class SyncService {
  /**
   * 检查是否有待同步的数据
   */
  async hasPendingSync(): Promise<boolean> {
    const pendingTasks = await db.tasks.where('syncStatus').equals('pending').count();
    const pendingJournals = await db.journals.where('syncStatus').equals('pending').count();
    return pendingTasks > 0 || pendingJournals > 0;
  }

  /**
   * 获取待同步的任务
   */
  async getPendingTasks() {
    return db.tasks.where('syncStatus').equals('pending').toArray();
  }

  /**
   * 获取待同步的日记
   */
  async getPendingJournals() {
    return db.journals.where('syncStatus').equals('pending').toArray();
  }

  /**
   * 记录同步日志
   */
  async logSync(
    entityType: 'task' | 'journal',
    entityId: string,
    operation: 'create' | 'update' | 'delete'
  ): Promise<void> {
    const log: SyncLog = {
      id: crypto.randomUUID(),
      entityType,
      entityId,
      operation,
      timestamp: new Date(),
      synced: false,
    };
    await db.syncLogs.add(log);
  }

  /**
   * 标记同步完成
   */
  async markSynced(entityType: 'task' | 'journal', entityId: string): Promise<void> {
    if (entityType === 'task') {
      await db.tasks.update(entityId, { syncStatus: 'synced' });
    } else {
      await db.journals.update(entityId, { syncStatus: 'synced' });
    }

    // 更新同步日志
    const logs = await db.syncLogs
      .where('[entityType+entityId]')
      .equals([entityType, entityId])
      .toArray();
    for (const log of logs) {
      await db.syncLogs.update(log.id, { synced: true });
    }
  }

  /**
   * 批量同步
   */
  async batchSync(): Promise<{ success: number; failed: number }> {
    // 这里应该调用后端API进行同步
    // 暂时返回模拟数据
    return { success: 0, failed: 0 };
  }
}

export const syncService = new SyncService();

