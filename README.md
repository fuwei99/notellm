---
title: notellm API 轻量级客户端
emoji: 📝
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
---
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
