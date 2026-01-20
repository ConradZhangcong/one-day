import { db } from './database';
import type { Project, CreateProjectDto, UpdateProjectDto } from '@/types/project';

/**
 * 计划仓库类
 */
export class ProjectRepository {
  /**
   * 创建计划
   */
  async create(dto: CreateProjectDto): Promise<Project> {
    const now = new Date();
    const project: Project = {
      id: crypto.randomUUID(),
      title: dto.title,
      description: dto.description || '',
      type: dto.type,
      startDate: dto.startDate,
      endDate: dto.endDate,
      status: 'active',
      progress: 0,
      tags: dto.tags || [],
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    await db.projects.add(project);
    return project;
  }

  /**
   * 根据ID获取计划
   */
  async getById(id: string): Promise<Project | undefined> {
    return db.projects.get(id);
  }

  /**
   * 获取所有计划
   */
  async getAll(): Promise<Project[]> {
    return db.projects.toArray();
  }

  /**
   * 更新计划
   */
  async update(id: string, dto: UpdateProjectDto): Promise<Project | undefined> {
    const project = await this.getById(id);
    if (!project) return undefined;

    const updated: Project = {
      ...project,
      ...dto,
      updatedAt: new Date(),
      syncStatus: 'pending',
    };

    await db.projects.update(id, updated);
    return updated;
  }

  /**
   * 删除计划
   */
  async delete(id: string): Promise<boolean> {
    const count = await db.projects.delete(id);
    return count > 0;
  }

  /**
   * 根据状态查询计划
   */
  async getByStatus(status: Project['status']): Promise<Project[]> {
    return db.projects.where('status').equals(status).toArray();
  }
}

export const projectRepository = new ProjectRepository();

