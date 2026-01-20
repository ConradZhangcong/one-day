import type { SyncStatus } from './task';

/**
 * 日记实体
 */
export interface Journal {
  id: string;
  date: Date;
  title: string | null;
  content: string; // Markdown格式
  mood: string | null;
  tags: string[];
  relatedTaskIds: string[]; // 关联的已办任务ID
  createdAt: Date;
  updatedAt: Date;
  encrypted: boolean; // 是否加密
  syncStatus: SyncStatus;
}

/**
 * 创建日记DTO
 */
export interface CreateJournalDto {
  date: Date;
  title?: string | null;
  content?: string;
  mood?: string | null;
  tags?: string[];
  relatedTaskIds?: string[];
  encrypted?: boolean;
}

/**
 * 更新日记DTO
 */
export interface UpdateJournalDto extends Partial<CreateJournalDto> {}

