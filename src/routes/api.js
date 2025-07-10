import { Router } from 'express';
import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { notionClient } from '../services/NotionClient.js';
import { streamManager } from '../services/StreamManager.js';
import { cookieManager } from '../CookieManager.js';
import { authenticate, addSessionToken } from '../middleware/auth.js';
import crypto from 'crypto';

const logger = createLogger('APIRouter');
const router = Router();

/**
 * POST /admin/login
 * 管理员登录端点
 */
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供用户名和密码'
      });
    }
    
    // 从环境变量获取管理员凭据
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.AUTH_TOKEN || 'admin123';
    
    // 验证用户名和密码
    if (username !== adminUsername || password !== adminPassword) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
    
    // 生成会话令牌
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // 保存会话令牌
    const user = { username: adminUsername };
    addSessionToken(sessionToken, user);
    
    // 返回登录成功信息
    res.json({
      success: true,
      user: user,
      token: sessionToken,
      message: '登录成功'
    });
    
    logger.info(`管理员 ${username} 登录成功`);
  } catch (error) {
    logger.error(`登录失败: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
});

/**
 * GET /v1/models
 * 返回可用的模型列表
 */
router.get('/v1/models', authenticate, (req, res) => {
  const modelList = {
    data: config.availableModels.map(id => ({ id }))
  };
  
  res.json(modelList);
});

/**
 * POST /v1/chat/completions
 * 处理聊天完成请求
 */
router.post('/v1/chat/completions', authenticate, async (req, res) => {
  const clientId = req.headers['x-client-id'] || randomUUID();
  
  try {
    // 验证系统状态
    const status = notionClient.getStatus();
    
    if (!status.initialized) {
      return res.status(500).json({
        error: {
          message: "系统未成功初始化。请检查您的NOTION_COOKIE是否有效。",
          type: "server_error"
        }
      });
    }
    
    if (status.validCookies === 0) {
      return res.status(500).json({
        error: {
          message: "没有可用的有效cookie。请检查您的NOTION_COOKIE配置。",
          type: "server_error"
        }
      });
    }
    
    // 验证请求数据
    const requestData = req.body;
    const validation = validateChatRequest(requestData);
    
    if (!validation.valid) {
      return res.status(400).json({
        error: {
          message: validation.error,
          type: "invalid_request_error"
        }
      });
    }
    
    // 构建Notion请求
    const notionRequestBody = notionClient.buildRequest(requestData);
    
    // 处理流式响应
    if (requestData.stream) {
      await handleStreamResponse(req, res, clientId, notionRequestBody);
    } else {
      await handleNonStreamResponse(req, res, clientId, notionRequestBody, requestData);
    }
    
  } catch (error) {
    logger.error(`聊天完成端点错误: ${error.message}`, error);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: `Internal server error: ${error.message}`,
          type: "server_error"
        }
      });
    }
  }
});

/**
 * GET /health
 * 健康检查端点
 */
router.get('/health', (req, res) => {
  const status = notionClient.getStatus();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    initialized: status.initialized,
    valid_cookies: status.validCookies,
    active_streams: streamManager.getActiveCount()
  });
});

/**
 * GET /cookies/status
 * Cookie状态查询端点
 */
router.get('/cookies/status', authenticate, (req, res) => {
  res.json({
    total_cookies: cookieManager.getValidCount(),
    cookies: cookieManager.getStatus()
  });
});

/**
 * POST /cookies/add
 * 添加新Cookie
 */
router.post('/cookies/add', authenticate, async (req, res) => {
  try {
    const { cookies, threadId } = req.body;
    
    if (!cookies) {
      return res.status(400).json({
        error: { message: '请提供cookie内容' }
      });
    }
    
    // 支持批量添加
    const cookieArray = cookies.includes('|') ? cookies.split('|') : [cookies];
    let added = 0;
    let failed = 0;
    const errors = [];
    
    for (const cookie of cookieArray) {
      const trimmedCookie = cookie.trim();
      if (!trimmedCookie) continue;
      
      const result = await cookieManager.addCookie(trimmedCookie, threadId);
      if (result.success) {
        added++;
      } else {
        failed++;
        errors.push(result.error);
      }
    }
    
    // 如果有成功添加的cookie，保存到cookies.txt文件
    if (added > 0 && config.cookie.filePath) {
      try {
        cookieManager.saveToFile(config.cookie.filePath, true);
        logger.info(`已将更新后的cookie保存到文件: ${config.cookie.filePath}`);
      } catch (saveError) {
        logger.error(`保存cookie到文件失败: ${saveError.message}`);
      }
    }
    
    res.json({
      success: true,
      added,
      failed,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    logger.error(`添加Cookie失败: ${error.message}`, error);
    res.status(500).json({
      error: { message: `添加Cookie失败: ${error.message}` }
    });
  }
});

/**
 * PUT /cookies/thread
 * 更新Cookie的Thread ID
 */
router.put('/cookies/thread', authenticate, (req, res) => {
  try {
    const { userId, threadId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        error: { message: '请提供用户ID' }
      });
    }
    
    const success = cookieManager.setThreadId(userId, threadId);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({
        error: { message: '未找到指定用户的Cookie' }
      });
    }
  } catch (error) {
    logger.error(`更新Thread ID失败: ${error.message}`, error);
    res.status(500).json({
      error: { message: `更新Thread ID失败: ${error.message}` }
    });
  }
});

/**
 * DELETE /cookies/:userId
 * 删除指定用户的Cookie
 */
router.delete('/cookies/:userId', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    
    const success = cookieManager.deleteCookie(userId);
    
    if (success) {
      // 删除成功后，保存到cookies.txt文件
      if (config.cookie.filePath) {
        try {
          cookieManager.saveToFile(config.cookie.filePath, true);
          logger.info(`已将更新后的cookie保存到文件: ${config.cookie.filePath}`);
        } catch (saveError) {
          logger.error(`保存cookie到文件失败: ${saveError.message}`);
        }
      }
      
      res.json({ success: true });
    } else {
      res.status(404).json({
        error: { message: '未找到指定用户的Cookie' }
      });
    }
  } catch (error) {
    logger.error(`删除Cookie失败: ${error.message}`, error);
    res.status(500).json({
      error: { message: `删除Cookie失败: ${error.message}` }
    });
  }
});

/**
 * POST /cookies/refresh
 * 刷新所有Cookie状态
 */
router.post('/cookies/refresh', authenticate, async (req, res) => {
  try {
    // 重新验证所有cookie
    const cookies = cookieManager.getStatus();
    let refreshed = 0;
    
    for (const cookie of cookies) {
      // 这里可以添加重新验证逻辑
      // 暂时只返回成功
      refreshed++;
    }
    
    res.json({
      success: true,
      refreshed,
      total: cookies.length
    });
  } catch (error) {
    logger.error(`刷新Cookie状态失败: ${error.message}`, error);
    res.status(500).json({
      error: { message: `刷新失败: ${error.message}` }
    });
  }
});

/**
 * PUT /cookies/:userId/toggle
 * 切换Cookie的启用状态
 */
router.put('/cookies/:userId/toggle', authenticate, (req, res) => {
  try {
    const { userId } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: { message: '请提供有效的enabled状态（true/false）' }
      });
    }
    
    const success = cookieManager.toggleCookie(userId, enabled);
    
    if (success) {
      res.json({ success: true, enabled });
    } else {
      res.status(404).json({
        error: { message: '未找到指定用户的Cookie' }
      });
    }
  } catch (error) {
    logger.error(`切换Cookie状态失败: ${error.message}`, error);
    res.status(500).json({
      error: { message: `切换状态失败: ${error.message}` }
    });
  }
});

/**
 * 验证聊天请求数据
 */
function validateChatRequest(requestData) {
  if (!requestData.messages) {
    return { valid: false, error: "Invalid request: 'messages' field is required." };
  }
  
  if (!Array.isArray(requestData.messages)) {
    return { valid: false, error: "Invalid request: 'messages' field must be an array." };
  }
  
  if (requestData.messages.length === 0) {
    return { valid: false, error: "Invalid request: 'messages' field must be a non-empty array." };
  }
  
  // 验证每个消息的格式
  for (const message of requestData.messages) {
    if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
      return { valid: false, error: "Invalid message format: each message must have a valid 'role' field." };
    }
    
    if (message.content === undefined || message.content === null) {
      return { valid: false, error: "Invalid message format: each message must have a 'content' field." };
    }
  }
  
  return { valid: true };
}

/**
 * 处理流式响应
 */
async function handleStreamResponse(req, res, clientId, notionRequestBody) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  logger.info(`开始流式响应 - 客户端: ${clientId}`);
  
  const stream = await notionClient.createStream(notionRequestBody);
  
  // 注册流
  streamManager.register(clientId, stream);
  
  // 将流连接到响应
  stream.pipe(res);
  
  // 处理客户端断开连接
  req.on('close', () => {
    logger.info(`客户端 ${clientId} 断开连接`);
    streamManager.close(clientId);
  });
  
  // 处理流错误
  stream.on('error', (error) => {
    logger.error(`流错误 - 客户端 ${clientId}: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: `Stream error: ${error.message}`,
          type: "server_error"
        }
      });
    }
  });
}

/**
 * 处理非流式响应
 */
async function handleNonStreamResponse(req, res, clientId, notionRequestBody, requestData) {
  logger.info(`开始非流式响应 - 客户端: ${clientId}`);
  
  const chunks = [];
  const stream = await notionClient.createStream(notionRequestBody);
  
  // 注册流
  streamManager.register(clientId, stream);
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      if (chunkStr.startsWith('data: ') && !chunkStr.includes('[DONE]')) {
        try {
          const dataJson = chunkStr.substring(6).trim();
          if (dataJson) {
            const chunkData = JSON.parse(dataJson);
            if (chunkData.choices && chunkData.choices[0].delta && chunkData.choices[0].delta.content) {
              chunks.push(chunkData.choices[0].delta.content);
            }
          }
        } catch (error) {
          logger.error(`解析非流式响应块时出错: ${error.message}`);
        }
      }
    });
    
    stream.on('end', () => {
      const fullResponse = {
        id: `chatcmpl-${randomUUID()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: requestData.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: chunks.join('')
            },
            finish_reason: "stop"
          }
        ],
        usage: {
          prompt_tokens: null,
          completion_tokens: null,
          total_tokens: null
        }
      };
      
      res.json(fullResponse);
      resolve();
    });
    
    stream.on('error', (error) => {
      logger.error(`非流式响应出错: ${error.message}`);
      reject(error);
    });
    
    // 处理客户端断开连接
    req.on('close', () => {
      logger.info(`客户端 ${clientId} 断开连接（非流式）`);
      streamManager.close(clientId);
    });
  });
}

export default router;
