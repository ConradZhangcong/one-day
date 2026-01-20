import dayjs, { type Dayjs } from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

/**
 * 日期工具函数
 */
export class DateUtils {
  /**
   * 格式化日期
   */
  static format(date: Date | string | Dayjs, format = 'YYYY-MM-DD'): string {
    return dayjs(date).format(format);
  }

  /**
   * 格式化日期时间
   */
  static formatDateTime(date: Date | string | Dayjs): string {
    return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * 格式化时间
   */
  static formatTime(date: Date | string | Dayjs): string {
    return dayjs(date).format('HH:mm');
  }

  /**
   * 获取今天的日期
   */
  static today(): Date {
    return dayjs().startOf('day').toDate();
  }

  /**
   * 获取明天的日期
   */
  static tomorrow(): Date {
    return dayjs().add(1, 'day').startOf('day').toDate();
  }

  /**
   * 获取本周开始日期
   */
  static startOfWeek(date?: Date): Date {
    return dayjs(date).startOf('week').toDate();
  }

  /**
   * 获取本周结束日期
   */
  static endOfWeek(date?: Date): Date {
    return dayjs(date).endOf('week').toDate();
  }

  /**
   * 获取本月开始日期
   */
  static startOfMonth(date?: Date): Date {
    return dayjs(date).startOf('month').toDate();
  }

  /**
   * 获取本月结束日期
   */
  static endOfMonth(date?: Date): Date {
    return dayjs(date).endOf('month').toDate();
  }

  /**
   * 判断是否为今天
   */
  static isToday(date: Date | string | Dayjs): boolean {
    return dayjs(date).isSame(dayjs(), 'day');
  }

  /**
   * 判断是否为明天
   */
  static isTomorrow(date: Date | string | Dayjs): boolean {
    return dayjs(date).isSame(dayjs().add(1, 'day'), 'day');
  }

  /**
   * 判断两个日期是否在同一天
   */
  static isSameDay(date1: Date | string | Dayjs, date2: Date | string | Dayjs): boolean {
    return dayjs(date1).isSame(dayjs(date2), 'day');
  }

  /**
   * 判断日期是否在范围内
   */
  static isInRange(
    date: Date | string | Dayjs,
    start: Date | string | Dayjs,
    end: Date | string | Dayjs
  ): boolean {
    return dayjs(date).isSameOrAfter(start, 'day') && dayjs(date).isSameOrBefore(end, 'day');
  }

  /**
   * 获取日期范围内的所有日期
   */
  static getDatesInRange(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    let current = dayjs(start);
    const endDate = dayjs(end);

    while (current.isSameOrBefore(endDate, 'day')) {
      dates.push(current.toDate());
      current = current.add(1, 'day');
    }

    return dates;
  }
}

export default DateUtils;

