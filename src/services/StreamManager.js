import { PassThrough } from 'stream';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('StreamManager');

/**
 * 流管理器 - 负责管理和跟踪活跃的流
 */
export class StreamManager {
  constructor() {
    this.activeStreams = new Map();
  }
  
  /**
   * 创建新的流
   * @returns {PassThrough} 新创建的流
   */
  createStream() {
    const stream = new PassThrough();
    let streamClosed = false;
    
    // 重写stream.end方法，确保安全关闭
    const originalEnd = stream.end;
    stream.end = function(...args) {
      if (streamClosed) return;
      streamClosed = true;
      return originalEnd.apply(this, args);
    };
    
    // 添加状态检查方法
    stream.isClosed = () => streamClosed;
    
    return stream;
  }
  
  /**
   * 注册并管理流
   * @param {string} clientId - 客户端ID
   * @param {Stream} stream - 要管理的流
   * @returns {Stream} 返回被管理的流
   */
  register(clientId, stream) {
    // 如果该客户端已有活跃流，先关闭它
    if (this.activeStreams.has(clientId)) {
      this.close(clientId);
    }
    
    // 注册新流
    this.activeStreams.set(clientId, stream);
    logger.debug(`注册客户端 ${clientId} 的新流`);
    
    // 设置流事件监听器
    stream.on('end', () => {
      if (this.activeStreams.get(clientId) === stream) {
        this.activeStreams.delete(clientId);
        logger.debug(`客户端 ${clientId} 的流已结束并移除`);
      }
    });
    
    stream.on('error', (error) => {
      logger.error(`客户端 ${clientId} 的流错误: ${error.message}`);
      if (this.activeStreams.get(clientId) === stream) {
        this.activeStreams.delete(clientId);
      }
    });
    
    return stream;
  }
  
  /**
   * 关闭指定客户端的流
   * @param {string} clientId - 客户端ID
   */
  close(clientId) {
    const stream = this.activeStreams.get(clientId);
    if (stream) {
      try {
        logger.debug(`关闭客户端 ${clientId} 的流`);
        stream.end();
        this.activeStreams.delete(clientId);
      } catch (error) {
        logger.error(`关闭流时出错: ${error.message}`);
      }
    }
  }
  
  /**
   * 获取指定客户端的流
   * @param {string} clientId - 客户端ID
   * @returns {Stream|null} 流对象或null
   */
  get(clientId) {
    return this.activeStreams.get(clientId) || null;
  }
  
  /**
   * 检查客户端是否有活跃流
   * @param {string} clientId - 客户端ID
   * @returns {boolean}
   */
  has(clientId) {
    return this.activeStreams.has(clientId);
  }
  
  /**
   * 获取活跃流的数量
   * @returns {number}
   */
  getActiveCount() {
    return this.activeStreams.size;
  }
  
  /**
   * 关闭所有流
   */
  closeAll() {
    logger.info(`关闭所有活跃流 (共 ${this.activeStreams.size} 个)`);
    for (const [clientId, stream] of this.activeStreams) {
      this.close(clientId);
    }
  }
  
  /**
   * 安全写入数据到流
   * @param {Stream} stream - 目标流
   * @param {string|Buffer} data - 要写入的数据
   * @returns {boolean} 写入是否成功
   */
  safeWrite(stream, data) {
    if (!stream || stream.destroyed || (stream.isClosed && stream.isClosed())) {
      return false;
    }
    
    try {
      return stream.write(data);
    } catch (error) {
      logger.error(`流写入错误: ${error.message}`);
      return false;
    }
  }
}

// 创建全局流管理器实例
export const streamManager = new StreamManager();
