---
title: Notion API 轻量级客户端
emoji: 📝
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
---

# Notion API 轻量级客户端 (Hugging Face Space)

这个项目提供了一个轻量级的 Notion API 客户端，可以作为 Web 服务部署在 Hugging Face Spaces 上。它兼容 OpenAI API 格式，让你可以将 Notion AI 作为后端集成到各种应用中。

## 🚀 在 Hugging Face Spaces 上部署

1.  **创建 Space**: 在 Hugging Face 上创建一个新的 Space。
2.  **选择 Docker SDK**: 在 "Choose an SDK" 步骤中，选择 "Docker"。
3.  **上传文件**: 将此项目的所有文件（包括 `Dockerfile`）上传到你的 Space Git 仓库中。
4.  **设置 Secrets**: 这是最重要的一步。你的 Notion 凭证和其他配置需要作为 Secrets 添加到 Space 中。进入你的 Space "Settings" 页面，找到 "Repository secrets" 部分，然后点击 "New secret" 添加以下变量：

    *   **必需**:
        *   `NOTION_COOKIE`: 你的 Notion Cookie。你可以通过浏览器开发者工具获取。
    *   **可选**:
        *   `NOTION_SPACE_ID`: 你的 Notion Space ID。
        *   `NOTION_ACTIVE_USER_HEADER`: 你的 Notion 用户 ID。
        *   `PROXY_URL`: 如果你需要通过代理访问 Notion，请设置此项 (例如 `http://user:pass@host:port`)。
        *   `PROXY_AUTH_TOKEN`: 如果你的代理需要单独的认证令牌，请设置此项。
        *   `COOKIE_FILE`: 如果你使用文件管理多个 Cookie，请设置为文件名 (例如 `cookies.txt`)。请确保该文件也已上传到仓库中。

    **注意**: `PORT` 环境变量由 Hugging Face 自动处理，你无需设置。

5.  **等待部署**: 添加完 Secrets 后，Hugging Face 会自动构建 Docker 镜像并部署你的应用。你可以在 "Logs" 标签页查看部署进度和应用日志。部署成功后，你的 API 端点即可使用。

## 📖 API 使用说明

服务启动后，你可以通过你的 Space URL 访问 API。

**基础 URL**: `https://<your-space-name>.hf.space`

### API 端点

-   `GET /v1/models` - 获取可用模型列表 (主要是为了兼容 OpenAI 客户端)
-   `POST /v1/chat/completions` - 核心的聊天完成端点
-   `GET /health` - 健康检查端点

### 示例: 使用 cURL 调用

```bash
curl -X POST https://<your-space-name>.hf.space/v1/chat/completions \
-H "Content-Type: application/json" \
-d '{
    "model": "openai-gpt-4.1",
    "messages": [
        {"role": "user", "content": "你好，请介绍一下你自己"}
    ],
    "stream": true
}'
```
*请将 `<your-space-name>` 替换为你的 Space 名称。*

## 🍪 Cookie 管理

为了提高服务的稳定性，你可以提供多个 Notion Cookie。

### 通过文件管理 Cookie

1.  在项目根目录创建一个 `cookies.txt` 或 `cookies.json` 文件。
2.  将文件上传到你的 Space 仓库。
3.  在 Space Secrets 中设置 `COOKIE_FILE` 为你的文件名 (例如 `cookies.txt`)。

系统启动时会自动从该文件加载Cookie。

**`cookies.txt` 示例:** (每行一个Cookie)
```
cookie1_string_here
cookie2_string_here
```

**`cookies.json` 示例:**
```json
{
  "cookies": [
    "cookie1_string_here",
    "cookie2_string_here"
  ]
}
```

### Cookie 轮询机制

系统会自动轮询使用所有有效的Cookie。当一个Cookie失效时（例如返回401错误），会自动切换到下一个有效的Cookie，确保服务不中断。

---

## 本地开发参考

以下信息用于在本地计算机上运行和开发。

### 依赖项
```bash
npm install
```

### 环境变量
创建 `.env` 文件，设置以下环境变量：
```
NOTION_COOKIE=your_notion_cookie_here
NOTION_SPACE_ID=optional_space_id
NOTION_ACTIVE_USER_HEADER=optional_user_id
PROXY_URL=optional_proxy_url
PROXY_AUTH_TOKEN=your_auth_token
PORT=7860
```

### 启动服务
```bash
npm start
```

### Cookie 管理命令行工具
项目提供了一个命令行工具来方便地管理 `cookies.json` 文件。
```bash
# 运行命令行工具
npm run cookie

# 支持的命令
help, list, add, validate, remove, save, load, exit
``` 