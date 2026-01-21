# 📦 部署指南

## 前置要求

- Docker 已安装并运行
- 有 Docker socket 访问权限
- 端口 2030 未被占用

## 快速开始

### 1️⃣ 启动 yx-tools 容器

```bash
# 创建工作目录
mkdir -p /home/yx-tools-web && cd /home/yx-tools-web

# 启动测速工具容器
docker run -d --name cf-speedtest \
  -v /home/yx-tools-web/data:/app/data \
  -v /home/yx-tools-web/config:/app/config \
  --restart unless-stopped \
  ghcr.nju.edu.cn/1williamaoayers/yx-tools:latest

# 检查容器状态
docker ps | grep cf-speedtest
```

### 2️⃣ 启动 Web 管理面板

#### 方式 A：使用预构建镜像（推荐）

```bash
# 拉取镜像
docker pull ghcr.io/你的用户名/yx-tools-web:latest

# 运行容器
docker run -d --name yx-tools-web \
  -p 2030:5000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /home/yx-tools-web/data:/data \
  -v /home/yx-tools-web/config:/config \
  -e CONTAINER_NAME=cf-speedtest \
  --restart unless-stopped \
  ghcr.io/你的用户名/yx-tools-web:latest

# 检查容器状态
docker ps | grep yx-tools-web

# 查看日志
docker logs -f yx-tools-web
```

#### 方式 B：本地构建

```bash
# 克隆项目
git clone https://github.com/你的用户名/yx-tools-web.git
cd yx-tools-web

# 构建镜像
docker build -t yx-tools-web ./web

# 运行容器
docker run -d --name yx-tools-web \
  -p 2030:5000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /home/yx-tools-web/data:/data \
  -v /home/yx-tools-web/config:/config \
  -e CONTAINER_NAME=cf-speedtest \
  --restart unless-stopped \
  yx-tools-web
```

### 3️⃣ 访问面板

打开浏览器访问: `http://你的服务器IP:2030`

## 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `CONTAINER_NAME` | cf-speedtest | yx-tools 容器名称 |
| `DATA_DIR` | /data | 数据目录（容器内路径）|
| `CONFIG_DIR` | /config | 配置目录（容器内路径）|

### 自定义配置示例

```bash
docker run -d --name yx-tools-web \
  -p 2030:5000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /home/yx-tools-web/data:/data \
  -v /home/yx-tools-web/config:/config \
  -e CONTAINER_NAME=my-speedtest \
  -e DATA_DIR=/data \
  -e CONFIG_DIR=/config \
  --restart unless-stopped \
  ghcr.io/你的用户名/yx-tools-web:latest
```

## 常见问题

### 1. 容器无法启动

**检查 Docker socket 权限**:
```bash
ls -l /var/run/docker.sock
```

**解决方案**:
```bash
# Linux
sudo chmod 666 /var/run/docker.sock

# 或者将用户加入 docker 组
sudo usermod -aG docker $USER
```

### 2. 无法访问面板

**检查端口占用**:
```bash
netstat -tuln | grep 2030
```

**检查防火墙**:
```bash
# CentOS/RHEL
sudo firewall-cmd --add-port=2030/tcp --permanent
sudo firewall-cmd --reload

# Ubuntu/Debian
sudo ufw allow 2030/tcp
```

### 3. 找不到 yx-tools 容器

**检查容器名称**:
```bash
docker ps -a | grep speedtest
```

**确保容器名称匹配**:
- Web 面板的 `CONTAINER_NAME` 环境变量
- yx-tools 容器的实际名称（`--name` 参数）

### 4. 测速结果不显示

**检查数据目录挂载**:
```bash
# 进入 yx-tools 容器
docker exec -it cf-speedtest ls -la /app/data

# 检查宿主机目录
ls -la /home/yx-tools-web/data
```

**手动触发测速**:
在 Web 面板点击"立即测速"按钮，等待 30 秒后刷新。

## 更新镜像

### 更新 Web 面板

```bash
# 停止并删除旧容器
docker stop yx-tools-web
docker rm yx-tools-web

# 拉取最新镜像
docker pull ghcr.io/你的用户名/yx-tools-web:latest

# 重新运行容器（使用相同命令）
docker run -d --name yx-tools-web \
  -p 2030:5000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /home/yx-tools-web/data:/data \
  -v /home/yx-tools-web/config:/config \
  -e CONTAINER_NAME=cf-speedtest \
  --restart unless-stopped \
  ghcr.io/你的用户名/yx-tools-web:latest
```

### 更新 yx-tools

```bash
# 停止并删除旧容器
docker stop cf-speedtest
docker rm cf-speedtest

# 拉取最新镜像
docker pull ghcr.nju.edu.cn/1williamaoayers/yx-tools:latest

# 重新运行容器
docker run -d --name cf-speedtest \
  -v /home/yx-tools-web/data:/app/data \
  -v /home/yx-tools-web/config:/app/config \
  --restart unless-stopped \
  ghcr.nju.edu.cn/1williamaoayers/yx-tools:latest
```

## 卸载

```bash
# 停止容器
docker stop yx-tools-web cf-speedtest

# 删除容器
docker rm yx-tools-web cf-speedtest

# 删除镜像（可选）
docker rmi ghcr.io/你的用户名/yx-tools-web:latest
docker rmi ghcr.nju.edu.cn/1williamaoayers/yx-tools:latest

# 删除数据（可选，会丢失所有配置和结果）
rm -rf /home/yx-tools-web
```

## 安全建议

### 1. 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name speedtest.yourdomain.com;

    location / {
        proxy_pass http://localhost:2030;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 2. 添加 Basic Auth

```nginx
server {
    listen 80;
    server_name speedtest.yourdomain.com;

    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://localhost:2030;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

生成密码文件:
```bash
sudo apt-get install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd admin
```

### 3. 限制 Docker Socket 权限

使用 Docker socket 代理（如 tecnativa/docker-socket-proxy）:

```bash
# 启动 socket 代理
docker run -d --name docker-proxy \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e CONTAINERS=1 \
  -e POST=1 \
  --restart unless-stopped \
  tecnativa/docker-socket-proxy

# Web 面板连接代理而非直接挂载 socket
docker run -d --name yx-tools-web \
  -p 2030:5000 \
  --link docker-proxy:docker \
  -e DOCKER_HOST=tcp://docker:2375 \
  -v /home/yx-tools-web/data:/data \
  -v /home/yx-tools-web/config:/config \
  -e CONTAINER_NAME=cf-speedtest \
  --restart unless-stopped \
  ghcr.io/你的用户名/yx-tools-web:latest
```

## 监控和日志

### 查看容器日志

```bash
# Web 面板日志
docker logs -f yx-tools-web

# yx-tools 日志
docker logs -f cf-speedtest

# 查看最近 100 行
docker logs --tail 100 yx-tools-web
```

### 监控容器状态

```bash
# 查看资源使用
docker stats yx-tools-web cf-speedtest

# 查看容器详情
docker inspect yx-tools-web
```

## 备份和恢复

### 备份配置和数据

```bash
# 创建备份
tar -czf yx-tools-backup-$(date +%Y%m%d).tar.gz /home/yx-tools-web

# 仅备份配置
tar -czf config-backup-$(date +%Y%m%d).tar.gz /home/yx-tools-web/config
```

### 恢复数据

```bash
# 停止容器
docker stop yx-tools-web cf-speedtest

# 恢复数据
tar -xzf yx-tools-backup-20260121.tar.gz -C /

# 重启容器
docker start cf-speedtest yx-tools-web
```

## 技术支持

- 项目地址: https://github.com/你的用户名/yx-tools-web
- 提交 Issue: https://github.com/你的用户名/yx-tools-web/issues
- yx-tools 项目: https://github.com/1williamaoayers/yx-tools
