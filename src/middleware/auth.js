import { createLogger } from '../utils/logger.js';
import { config } from '../config/index.js';

const logger = createLogger('AuthMiddleware');

// 存储有效的会话令牌（实际生产环境中应使用Redis或其他持久化存储）
const sessionTokens = new Map();

/**
 * 认证中间件
 * 验证请求的Bearer token
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warning(`认证失败: 缺少Bearer token - IP: ${req.ip}`);
    return res.status(401).json({
      error: {
        message: "Authentication required. Please provide a valid Bearer token.",
        type: "authentication_error"
      }
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  // 首先检查是否是管理员会话令牌
  if (sessionTokens.has(token)) {
    const session = sessionTokens.get(token);
    // 检查会话是否过期（24小时）
    if (new Date().getTime() - session.timestamp < 24 * 60 * 60 * 1000) {
      logger.debug(`认证成功（管理员会话） - IP: ${req.ip}`);
      req.user = session.user;
      return next();
    } else {
      // 会话过期，删除令牌
      sessionTokens.delete(token);
    }
  }
  
  // 检查是否是API令牌
  if (token !== config.server.authToken) {
    logger.warning(`认证失败: 无效的token - IP: ${req.ip}`);
    return res.status(401).json({
      error: {
        message: "Invalid authentication credentials",
        type: "authentication_error"
      }
    });
  }
  
  logger.debug(`认证成功（API令牌） - IP: ${req.ip}`);
  next();
}

/**
 * 添加会话令牌
 */
export function addSessionToken(token, user) {
  sessionTokens.set(token, {
    user,
    timestamp: new Date().getTime()
  });
}

/**
 * 清理过期的会话令牌
 */
setInterval(() => {
  const now = new Date().getTime();
  for (const [token, session] of sessionTokens.entries()) {
    if (now - session.timestamp > 24 * 60 * 60 * 1000) {
      sessionTokens.delete(token);
    }
  }
}, 60 * 60 * 1000); // 每小时清理一次

/**
 * 请求日志中间件
 * 记录所有请求的详细信息
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  // 保存原始的 end 方法
  const originalEnd = res.end;
  
  // 重写 end 方法以记录请求完成时间
  res.end = function(...args) {
    const duration = Date.now() - start;
    logger.request(req.method, req.path, res.statusCode, duration);
    return originalEnd.apply(this, args);
  };
  
  next();
}

/**
 * 错误处理中间件
 * 统一处理所有未捕获的错误
 */
export function errorHandler(err, req, res, next) {
  logger.error(`未处理的错误: ${err.message}`, err);
  
  // 如果响应已经发送，则交给默认错误处理器
  if (res.headersSent) {
    return next(err);
  }
  
  // 发送错误响应
  res.status(500).json({
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
      type: 'server_error'
    }
  });
}

/**
 * 请求体大小限制中间件配置
 */
export const requestLimits = {
  json: { limit: '50mb' },
  urlencoded: { extended: true, limit: '50mb' }
};
