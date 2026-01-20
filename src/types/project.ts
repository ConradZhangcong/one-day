import type { SyncStatus } from './task';

/**
 * 计划类型
 */
export type ProjectType = 'long_term' | 'short_term';

/**
 * 计划状态
 */
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled';

/**
 * 计划实体
 */
export interface Project {
  id: string;
  title: string;
  description: string;
  type: ProjectType;
  startDate: Date;
  endDate: Date;
  status: ProjectStatus;
  progress: number; // 0-100
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  syncStatus: SyncStatus;
}

/**
 * 创建计划DTO
 */
export interface CreateProjectDto {
  title: string;
  description?: string;
  type: ProjectType;
  startDate: Date;
  endDate: Date;
  tags?: string[];
}

/**
 * 更新计划DTO
 */
export interface UpdateProjectDto extends Partial<CreateProjectDto> {
  status?: ProjectStatus;
  progress?: number;
}

