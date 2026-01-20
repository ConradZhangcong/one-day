import { db } from './database';
import type { Journal, CreateJournalDto, UpdateJournalDto } from '@/types/journal';

/**
 * 日记仓库类
 */
export class JournalRepository {
  /**
   * 创建日记
   */
  async create(dto: CreateJournalDto): Promise<Journal> {
    const now = new Date();
    const journal: Journal = {
      id: crypto.randomUUID(),
      date: dto.date,
      title: dto.title || null,
      content: dto.content || '',
      mood: dto.mood || null,
      tags: dto.tags || [],
      relatedTaskIds: dto.relatedTaskIds || [],
      createdAt: now,
      updatedAt: now,
      encrypted: dto.encrypted || false,
      syncStatus: 'pending',
    };

    await db.journals.add(journal);
    return journal;
  }

  /**
   * 根据ID获取日记
   */
  async getById(id: string): Promise<Journal | undefined> {
    return db.journals.get(id);
  }

  /**
   * 获取所有日记
   */
  async getAll(): Promise<Journal[]> {
    return db.journals.toArray();
  }

  /**
   * 更新日记
   */
  async update(id: string, dto: UpdateJournalDto): Promise<Journal | undefined> {
    const journal = await this.getById(id);
    if (!journal) return undefined;

    const updated: Journal = {
      ...journal,
      ...dto,
      updatedAt: new Date(),
      syncStatus: 'pending',
    };

    await db.journals.update(id, updated);
    return updated;
  }

  /**
   * 删除日记
   */
  async delete(id: string): Promise<boolean> {
    const count = await db.journals.delete(id);
    return count > 0;
  }

  /**
   * 根据日期获取日记
   */
  async getByDate(date: Date): Promise<Journal | undefined> {
    const dateStr = date.toISOString().split('T')[0];
    const journals = await db.journals
      .filter((journal) => {
        const journalDateStr = journal.date.toISOString().split('T')[0];
        return journalDateStr === dateStr;
      })
      .toArray();
    return journals[0];
  }

  /**
   * 根据日期范围查询日记
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<Journal[]> {
    return db.journals
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }
}

export const journalRepository = new JournalRepository();

