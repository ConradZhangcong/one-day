/**
 * 加密工具类
 * 使用 Web Crypto API 进行数据加密
 */
export class EncryptionUtils {
  /**
   * 生成加密密钥
   */
  static async generateKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    // 使用 PBKDF2 派生密钥
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      data,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * 加密数据
   */
  static async encrypt(data: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      dataBuffer
    );

    // 将 iv 和加密数据组合
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // 转换为 base64
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * 解密数据
   */
  static async decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
    // 从 base64 解码
    const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
}

export default EncryptionUtils;

