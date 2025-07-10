/**
 * 轻量级客户端 - 导出接口
 * 
 * 这个文件提供了向后兼容的接口，
 * 实际功能已经被重构到各个独立的模块中
 */

import { notionClient } from './services/NotionClient.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('LightweightClient');

// 导出初始化函数
export async function initialize() {
  try {
    await notionClient.initialize();
    return true;
  } catch (error) {
    logger.error(`初始化失败: ${error.message}`, error);
    return false;
  }
}

// 导出流式响应函数
export async function streamNotionResponse(notionRequestBody) {
  return notionClient.createStream(notionRequestBody);
}

// 导出构建请求函数
export function buildNotionRequest(requestData) {
  return notionClient.buildRequest(requestData);
}

// 导出初始化状态
export const INITIALIZED_SUCCESSFULLY = () => notionClient.getStatus().initialized;

// 向后兼容性导出
export { notionClient };
