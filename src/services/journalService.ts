import { journalRepository } from '@/db/journalRepository';
import type { Journal, CreateJournalDto, UpdateJournalDto } from '@/types/journal';

/**
 * 日记服务类
 */
export class JournalService {
  /**
   * 创建日记
   */
  async createJournal(dto: CreateJournalDto): Promise<Journal> {
    return journalRepository.create(dto);
  }

  /**
   * 获取日记
   */
  async getJournal(id: string): Promise<Journal | undefined> {
    return journalRepository.getById(id);
  }

  /**
   * 获取所有日记
   */
  async getAllJournals(): Promise<Journal[]> {
    return journalRepository.getAll();
  }

  /**
   * 更新日记
   */
  async updateJournal(id: string, dto: UpdateJournalDto): Promise<Journal | undefined> {
    return journalRepository.update(id, dto);
  }

  /**
   * 删除日记
   */
  async deleteJournal(id: string): Promise<boolean> {
    return journalRepository.delete(id);
  }

  /**
   * 根据日期获取日记
   */
  async getJournalByDate(date: Date): Promise<Journal | undefined> {
    return journalRepository.getByDate(date);
  }

  /**
   * 根据日期范围查询日记
   */
  async getJournalsByDateRange(startDate: Date, endDate: Date): Promise<Journal[]> {
    return journalRepository.getByDateRange(startDate, endDate);
  }
}

export const journalService = new JournalService();

