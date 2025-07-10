import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('Storage');

/**
 * 持久化存储管理器
 * 用于保存和加载Cookie数据（包括Thread ID）
 */
class StorageManager {
  constructor() {
    // 数据文件路径
    this.dataFilePath = path.join(dirname(dirname(__dirname)), 'data', 'cookies-data.json');
    this.backupFilePath = path.join(dirname(dirname(__dirname)), 'data', 'cookies-data.backup.json');
    
    // 确保数据目录存在
    this.ensureDataDirectory();
  }

  /**
   * 确保数据目录存在
   */
  ensureDataDirectory() {
    const dataDir = path.dirname(this.dataFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info(`创建数据目录: ${dataDir}`);
    }
  }

  /**
   * 保存Cookie数据到文件
   * @param {Array} cookieEntries - Cookie条目数组
   * @returns {boolean} - 是否保存成功
   */
  saveCookieData(cookieEntries) {
    try {
      // 准备要保存的数据
      const dataToSave = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        cookies: cookieEntries.map(entry => ({
          userId: entry.userId,
          spaceId: entry.spaceId,
          threadId: entry.threadId,
          enabled: entry.enabled,
          valid: entry.valid,
          lastUsed: entry.lastUsed,
          // 不保存实际的cookie值，只保存其哈希或标识
          cookieHash: this.hashCookie(entry.cookie)
        }))
      };

      // 先备份现有文件
      if (fs.existsSync(this.dataFilePath)) {
        fs.copyFileSync(this.dataFilePath, this.backupFilePath);
      }

      // 保存新数据
      fs.writeFileSync(this.dataFilePath, JSON.stringify(dataToSave, null, 2), 'utf8');
      logger.info(`成功保存 ${cookieEntries.length} 个Cookie的数据`);
      return true;
    } catch (error) {
      logger.error(`保存Cookie数据失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 加载Cookie数据
   * @returns {Object|null} - 加载的数据或null
   */
  loadCookieData() {
    try {
      if (!fs.existsSync(this.dataFilePath)) {
        logger.info('Cookie数据文件不存在');
        return null;
      }

      const fileContent = fs.readFileSync(this.dataFilePath, 'utf8');
      const data = JSON.parse(fileContent);
      
      logger.info(`成功加载 ${data.cookies?.length || 0} 个Cookie的数据`);
      return data;
    } catch (error) {
      logger.error(`加载Cookie数据失败: ${error.message}`);
      
      // 尝试从备份恢复
      if (fs.existsSync(this.backupFilePath)) {
        try {
          logger.info('尝试从备份文件恢复...');
          const backupContent = fs.readFileSync(this.backupFilePath, 'utf8');
          const backupData = JSON.parse(backupContent);
          
          // 将备份恢复为主文件
          fs.copyFileSync(this.backupFilePath, this.dataFilePath);
          logger.success('成功从备份恢复数据');
          return backupData;
        } catch (backupError) {
          logger.error(`从备份恢复失败: ${backupError.message}`);
        }
      }
      
      return null;
    }
  }

  /**
   * 合并保存的数据和内存中的Cookie条目
   * @param {Array} cookieEntries - 内存中的Cookie条目
   * @param {Object} savedData - 保存的数据
   * @returns {Array} - 合并后的Cookie条目
   */
  mergeCookieData(cookieEntries, savedData) {
    if (!savedData || !savedData.cookies) {
      return cookieEntries;
    }

    const mergedEntries = [];
    
    // 为每个内存中的cookie条目恢复保存的数据
    for (const entry of cookieEntries) {
      const savedEntry = savedData.cookies.find(saved => 
        saved.userId === entry.userId || 
        saved.cookieHash === this.hashCookie(entry.cookie)
      );
      
      if (savedEntry) {
        // 恢复保存的数据
        entry.threadId = savedEntry.threadId || entry.threadId;
        entry.enabled = savedEntry.enabled !== undefined ? savedEntry.enabled : entry.enabled;
        entry.lastUsed = savedEntry.lastUsed || entry.lastUsed;
        
        logger.info(`恢复用户 ${entry.userId} 的数据: threadId=${entry.threadId}`);
      }
      
      mergedEntries.push(entry);
    }
    
    return mergedEntries;
  }

  /**
   * 生成Cookie的哈希值（用于匹配，不存储实际cookie）
   * @param {string} cookie - Cookie字符串
   * @returns {string} - 哈希值
   */
  hashCookie(cookie) {
    if (!cookie) return '';
    
    // 简单的哈希实现，取cookie的前20个字符和后20个字符
    const prefix = cookie.substring(0, 20);
    const suffix = cookie.substring(Math.max(0, cookie.length - 20));
    return `${prefix}...${suffix}`;
  }

  /**
   * 清理过期数据
   * @param {number} daysToKeep - 保留多少天的数据
   */
  cleanupOldData(daysToKeep = 30) {
    try {
      const dataDir = path.dirname(this.dataFilePath);
      const files = fs.readdirSync(dataDir);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      files.forEach(file => {
        if (file.startsWith('cookies-data') && file.endsWith('.backup.json')) {
          const filePath = path.join(dataDir, file);
          const stats = fs.statSync(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            logger.info(`删除过期备份文件: ${file}`);
          }
        }
      });
    } catch (error) {
      logger.error(`清理过期数据失败: ${error.message}`);
    }
  }
}

export const storageManager = new StorageManager();
