import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
dotenv.config({ path: join(dirname(dirname(__dirname)), '.env') });

/**
 * 应用配置中心
 * 集中管理所有配置项，提供类型安全的配置访问
 */
export const config = {
  // 服务器配置
  server: {
    port: parseInt(process.env.PORT || '7860', 10),
    authToken: process.env.PROXY_AUTH_TOKEN || 'default_token',
  },
  
  // Notion API配置
  notion: {
    apiUrl: 'https://www.notion.so/api/v3/runInferenceTranscript',
    clientVersion: '23.13.0.3686',
    origin: 'https://www.notion.so',
    referer: 'https://www.notion.so/chat',
  },
  
  // 代理配置
  proxy: {
    useNativePool: process.env.USE_NATIVE_PROXY_POOL === 'true',
    enableServer: process.env.ENABLE_PROXY_SERVER === 'true',
    url: process.env.PROXY_URL || '',
    country: process.env.PROXY_COUNTRY || 'us',
    serverPort: 10655,
  },
  
  // Cookie配置
  cookie: {
    filePath: process.env.COOKIE_FILE,
    envCookies: process.env.NOTION_COOKIE,
  },
  
  // 请求超时配置
  timeout: {
    request: 30000, // 30秒
  },
  
  // 模型映射
  modelMapping: {
    'google-gemini-2.5-pro': 'vertex-gemini-2.5-pro',
    'google-gemini-2.5-flash': 'vertex-gemini-2.5-flash',
  },
  
  // 可用模型列表
  availableModels: [
    'openai-gpt-4.1',
    'anthropic-opus-4',
    'anthropic-sonnet-4',
    'anthropic-sonnet-3.x-stable',
    'google-gemini-2.5-pro',
    'google-gemini-2.5-flash',
  ],
};

// 验证必要的配置
export function validateConfig() {
  const errors = [];
  
  if (!config.cookie.filePath && !config.cookie.envCookies) {
    errors.push('必须设置 COOKIE_FILE 或 NOTION_COOKIE 环境变量');
  }
  
  if (config.proxy.useNativePool && !['us', 'uk', 'jp', 'de', 'fr', 'ca'].includes(config.proxy.country)) {
    errors.push('PROXY_COUNTRY 必须是以下之一: us, uk, jp, de, fr, ca');
  }
  
  return errors;
}
