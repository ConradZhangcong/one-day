import Dexie, { type Table } from 'dexie';
import type { Task } from '@/types/task';
import type { Project } from '@/types/project';
import type { Journal } from '@/types/journal';

/**
 * 标签实体
 */
export interface Tag {
  id: string;
  name: string;
  color: string;
  category: string | null;
  createdAt: Date;
}

/**
 * 设置实体
 */
export interface Setting {
  key: string;
  value: any; // JSON格式
  updatedAt: Date;
}

/**
 * 同步日志实体
 */
export interface SyncLog {
  id: string;
  entityType: 'task' | 'project' | 'journal';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: Date;
  synced: boolean;
}

/**
 * IndexedDB 数据库类
 */
export class AppDatabase extends Dexie {
  tasks!: Table<Task>;
  projects!: Table<Project>;
  journals!: Table<Journal>;
  tags!: Table<Tag>;
  settings!: Table<Setting>;
  syncLogs!: Table<SyncLog>;

  constructor() {
    super('OneDayDB');

    // 定义数据库表结构
    this.version(1).stores({
      tasks: 'id, status, startDate, deadline, projectId, tags, syncStatus',
      projects: 'id, status, startDate, endDate, syncStatus',
      journals: 'id, date, tags, syncStatus',
      tags: 'id, name, category',
      settings: 'key',
      syncLogs: 'id, entityType, entityId, synced, timestamp',
    });
  }
}

// 导出数据库实例
export const db = new AppDatabase();

