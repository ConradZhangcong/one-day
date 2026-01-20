/**
 * 验证工具函数
 */
export class Validators {
  /**
   * 验证邮箱格式
   */
  static isEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 验证URL格式
   */
  static isUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证是否为空字符串
   */
  static isEmpty(value: string | null | undefined): boolean {
    return !value || value.trim().length === 0;
  }

  /**
   * 验证字符串长度
   */
  static isLength(value: string, min: number, max?: number): boolean {
    if (value.length < min) return false;
    if (max !== undefined && value.length > max) return false;
    return true;
  }

  /**
   * 验证日期格式
   */
  static isDate(value: any): boolean {
    return value instanceof Date && !isNaN(value.getTime());
  }
}

export default Validators;

