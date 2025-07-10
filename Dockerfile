# 使用官方 Node.js 18 slim 镜像作为基础
FROM node:18-slim

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装项目依赖
# 我们只安装生产环境需要的包，以减小镜像体积
RUN npm install --production

# 复制项目源代码
COPY . .

# 解决权限问题：将工作目录的所有权交给 node 用户
# node 镜像默认使用非 root 的 'node' 用户运行应用
# /app 目录默认由 root 创建，导致应用没有写入权限
RUN chown -R node:node /app

# 确保代理服务器可执行 (Hugging Face Spaces 通常运行在 linux/amd64 架构上)
RUN chmod +x src/proxy/chrome_proxy_server_linux_amd64

# 暴露应用端口 (Hugging Face 会自动映射)
EXPOSE 7860

# 启动应用
CMD ["npm", "start"]
