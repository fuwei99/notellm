import chalk from 'chalk';

/**
 * 日志级别枚举
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  SUCCESS: 4,
};

/**
 * 统一的日志管理器
 */
class Logger {
  constructor(name = 'app') {
    this.name = name;
    this.level = LogLevel.INFO;
  }
  
  setLevel(level) {
    this.level = level;
  }
  
  debug(message) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(chalk.gray(`[debug][${this.name}] ${message}`));
    }
  }
  
  info(message) {
    if (this.level <= LogLevel.INFO) {
      console.log(chalk.blue(`[info][${this.name}] ${message}`));
    }
  }
  
  warning(message) {
    if (this.level <= LogLevel.WARNING) {
      console.warn(chalk.yellow(`[warn][${this.name}] ${message}`));
    }
  }
  
  error(message, error = null) {
    if (this.level <= LogLevel.ERROR) {
      console.error(chalk.red(`[error][${this.name}] ${message}`));
      if (error && error.stack) {
        console.error(chalk.red(error.stack));
      }
    }
  }
  
  success(message) {
    if (this.level <= LogLevel.SUCCESS) {
      console.log(chalk.green(`[success][${this.name}] ${message}`));
    }
  }
  
  request(method, path, status, time) {
    if (this.level <= LogLevel.INFO) {
      const statusColor = status >= 500 ? chalk.red : 
                          status >= 400 ? chalk.yellow : 
                          status >= 300 ? chalk.cyan : 
                          status >= 200 ? chalk.green : chalk.white;
      console.log(`${chalk.magenta(`[${method}]`)} - ${path} ${statusColor(status)} ${chalk.gray(`${time}ms`)}`);
    }
  }
}

// 创建默认日志实例
export const defaultLogger = new Logger();

// 创建具名日志实例的工厂函数
export function createLogger(name) {
  return new Logger(name);
}

// 导出默认方法
export default {
  debug: (message) => defaultLogger.debug(message),
  info: (message) => defaultLogger.info(message),
  warning: (message) => defaultLogger.warning(message),
  error: (message, error) => defaultLogger.error(message, error),
  success: (message) => defaultLogger.success(message),
  request: (method, path, status, time) => defaultLogger.request(method, path, status, time),
  setLevel: (level) => defaultLogger.setLevel(level),
};
