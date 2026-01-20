import dayjs from 'dayjs';
import type { RecurrenceRule } from '@/types/task';
import { DateUtils } from './dateUtils';

/**
 * 重复任务工具类
 */
export class RecurrenceUtils {
  /**
   * 根据重复规则生成指定日期范围内的任务实例
   */
  static generateInstances(
    rule: RecurrenceRule,
    startDate: Date,
    rangeStart: Date,
    rangeEnd: Date
  ): Date[] {
    const instances: Date[] = [];
    let current = dayjs(startDate);
    const end = dayjs(rangeEnd);

    // 如果开始日期在范围之前，调整到范围开始
    if (current.isBefore(rangeStart, 'day')) {
      current = dayjs(rangeStart);
    }

    let count = 0;
    const maxIterations = 1000; // 防止无限循环

    while (current.isSameOrBefore(end, 'day') && count < maxIterations) {
      // 检查是否应该生成这个日期
      if (this.shouldGenerateOnDate(current.toDate(), rule, startDate)) {
        // 检查是否在排除日期列表中
        if (!rule.excludeDates?.some((excludeDate) => DateUtils.isSameDay(current.toDate(), excludeDate))) {
          instances.push(current.toDate());
        }
      }

      // 移动到下一个可能的日期
      current = this.getNextDate(current.toDate(), rule, startDate);

      // 检查结束条件
      if (rule.endType === 'count') {
        const generatedCount = instances.length;
        if (generatedCount >= (rule.endCount || 0)) {
          break;
        }
      }
      if (rule.endType === 'date' && rule.endDate) {
        if (current.isAfter(rule.endDate, 'day')) {
          break;
        }
      }

      count++;
    }

    return instances;
  }

  /**
   * 判断是否应该在指定日期生成任务
   */
  private static shouldGenerateOnDate(
    date: Date,
    rule: RecurrenceRule,
    startDate: Date
  ): boolean {
    const d = dayjs(date);
    const start = dayjs(startDate);

    // 不能早于开始日期
    if (d.isBefore(start, 'day')) {
      return false;
    }

    switch (rule.frequency) {
      case 'daily':
        return this.isDailyMatch(d, start, rule);
      case 'weekly':
        return this.isWeeklyMatch(d, start, rule);
      case 'monthly':
        return this.isMonthlyMatch(d, start, rule);
      case 'yearly':
        return this.isYearlyMatch(d, start, rule);
      case 'custom':
        return this.isCustomMatch(d, start, rule);
      default:
        return false;
    }
  }

  /**
   * 获取下一个可能的日期
   */
  private static getNextDate(date: Date, rule: RecurrenceRule, startDate: Date): dayjs.Dayjs {
    const d = dayjs(date);
    const interval = rule.interval || 1;

    switch (rule.frequency) {
      case 'daily':
        return d.add(interval, 'day');
      case 'weekly':
        return d.add(interval, 'week');
      case 'monthly':
        return d.add(interval, 'month');
      case 'yearly':
        return d.add(interval, 'year');
      case 'custom':
        return d.add(interval, 'day');
      default:
        return d.add(1, 'day');
    }
  }

  /**
   * 每日重复匹配
   */
  private static isDailyMatch(date: dayjs.Dayjs, start: dayjs.Dayjs, rule: RecurrenceRule): boolean {
    const interval = rule.interval || 1;
    const daysDiff = date.diff(start, 'day');
    return daysDiff % interval === 0;
  }

  /**
   * 每周重复匹配
   */
  private static isWeeklyMatch(date: dayjs.Dayjs, start: dayjs.Dayjs, rule: RecurrenceRule): boolean {
    if (rule.byWeekday && rule.byWeekday.length > 0) {
      const weekday = date.day();
      return rule.byWeekday.includes(weekday);
    }
    return date.day() === start.day();
  }

  /**
   * 每月重复匹配
   */
  private static isMonthlyMatch(date: dayjs.Dayjs, start: dayjs.Dayjs, rule: RecurrenceRule): boolean {
    if (rule.byMonthDay && rule.byMonthDay.length > 0) {
      const day = date.date();
      return rule.byMonthDay.includes(day);
    }
    return date.date() === start.date();
  }

  /**
   * 每年重复匹配
   */
  private static isYearlyMatch(date: dayjs.Dayjs, start: dayjs.Dayjs, rule: RecurrenceRule): boolean {
    return date.month() === start.month() && date.date() === start.date();
  }

  /**
   * 自定义重复匹配
   */
  private static isCustomMatch(date: dayjs.Dayjs, start: dayjs.Dayjs, rule: RecurrenceRule): boolean {
    // 自定义逻辑可以根据具体需求实现
    const interval = rule.interval || 1;
    const daysDiff = date.diff(start, 'day');
    return daysDiff % interval === 0;
  }
}

export default RecurrenceUtils;

