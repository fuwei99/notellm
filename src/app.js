import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createLogger } from './utils/logger.js';
import { config, validateConfig } from './config/index.js';
import { notionClient } from './services/NotionClient.js';
import { streamManager } from './services/StreamManager.js';
import { proxyPool } from './ProxyPool.js';
import { proxyServer } from './ProxyServer.js';
import { requestLogger, errorHandler, requestLimits } from './middleware/auth.js';
import apiRouter from './routes/api.js';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('App');

/**
 * 应用程序类
 * 负责初始化和管理整个应用
 */
class Application {
  constructor() {
    this.app = express();
    this.server = null;
  }
  
  /**
   * 配置Express中间件
   */
  configureMiddleware() {
    // 请求体解析
    this.app.use(express.json(requestLimits.json));
    this.app.use(express.urlencoded(requestLimits.urlencoded));
    
    // 静态文件服务
    const publicPath = join(dirname(__dirname), 'public');
    this.app.use(express.static(publicPath));
    
    // 管理界面路由
    this.app.get('/admin', (req, res) => {
      res.sendFile(join(publicPath, 'admin.html'));
    });
    
    // 请求日志
    this.app.use(requestLogger);
    
    // API路由
    this.app.use(apiRouter);
    
    // 错误处理（必须放在最后）
    this.app.use(errorHandler);
  }
  
  /**
   * 初始化服务
   */
  async initializeServices() {
    // 验证配置
    const configErrors = validateConfig();
    if (configErrors.length > 0) {
      throw new Error(`配置错误:\n${configErrors.join('\n')}`);
    }
    
    // 初始化代理服务器
    if (config.proxy.enableServer) {
      try {
        await proxyServer.start();
        logger.success('代理服务器启动成功');
      } catch (error) {
        logger.error(`启动代理服务器失败: ${error.message}`);
        // 代理服务器启动失败不应该阻止应用启动
      }
    }
    
    // 初始化Notion客户端
    await notionClient.initialize();
    
    // 初始化代理池
    if (config.proxy.useNativePool) {
      logger.info('正在初始化本地代理池...');
      proxyPool.logLevel = 'info';
      proxyPool.showProgressBar = true;
      proxyPool.setCountry(config.proxy.country);
      await proxyPool.initialize();
      logger.success(`代理池初始化完成，当前代理国家: ${proxyPool.proxyCountry}`);
    }
  }
  
  /**
   * 启动应用
   */
  async start() {
    try {
      // 初始化服务
      await this.initializeServices();
      
      // 配置中间件
      this.configureMiddleware();
      
      // 启动服务器
      this.server = this.app.listen(config.server.port, () => {
        logger.info(`服务已启动 - 端口: ${config.server.port}`);
        logger.info(`访问地址: http://localhost:${config.server.port}`);
        logger.info(`管理界面: http://localhost:${config.server.port}/admin`);
        
        const status = notionClient.getStatus();
        if (status.initialized) {
          logger.success('系统初始化状态: ✅');
          logger.success(`可用cookie数量: ${status.validCookies}`);
        } else {
          logger.warning('系统初始化状态: ❌');
          logger.warning('警告: 系统未成功初始化，API调用将无法正常工作');
          logger.warning('请检查NOTION_COOKIE配置是否有效');
        }
      });
      
    } catch (error) {
      logger.error(`应用启动失败: ${error.message}`, error);
      process.exit(1);
    }
  }
  
  /**
   * 优雅关闭应用
   */
  async shutdown() {
    logger.info('正在关闭应用...');
    
    // 关闭所有活跃流
    streamManager.closeAll();
    
    // 关闭代理服务器
    if (proxyServer) {
      try {
        proxyServer.stop();
        logger.info('代理服务器已关闭');
      } catch (error) {
        logger.error(`关闭代理服务器时出错: ${error.message}`);
      }
    }
    
    // 关闭Express服务器
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
      logger.info('HTTP服务器已关闭');
    }
    
    logger.success('应用已优雅关闭');
  }
}

// 创建应用实例
const application = new Application();

// 注册进程信号处理
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('SIGQUIT', handleShutdown);

async function handleShutdown(signal) {
  logger.info(`收到${signal}信号，正在关闭应用...`);
  await application.shutdown();
  process.exit(0);
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

application.start();

export { application };
