# yx-tools-web

为 [yx-tools](https://github.com/1williamaoayers/yx-tools) 提供的 Web 管理面板。

## ✨ 功能

- 📊 查看测速结果
- ⚙️ 修改配置参数（模式、数量、地区）
- ⏰ 管理定时任务
- ▶️ 手动触发测速

## 🚀 部署方式

### 方式一：使用 GitHub 预构建镜像（推荐）

#### 1. 先启动 yx-tools 容器

```bash
mkdir -p /home/yx-tools-web && cd /home/yx-tools-web

docker run -d --name cf-speedtest \
  -v /home/yx-tools-web/data:/app/data \
  -v /home/yx-tools-web/config:/app/config \
  --restart unless-stopped \
  ghcr.nju.edu.cn/1williamaoayers/yx-tools:latest
```

#### 2. 直接运行 Web 面板（无需构建）

```bash
# 拉取并运行预构建镜像
docker run -d --name yx-tools-web \
  -p 2030:5000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /home/yx-tools-web/data:/data \
  -v /home/yx-tools-web/config:/config \
  -e CONTAINER_NAME=cf-speedtest \
  --restart unless-stopped \
  ghcr.nju.edu.cn/1williamaoayers/yx-tools-web:latest
```

> 💡 **提示**: 将 `1williamaoayers` 替换为你的 GitHub 用户名（如果不同）

#### 3. 访问面板

打开浏览器访问: http://你的IP:2030

---

### 方式二：本地构建镜像

#### 1. 先启动 yx-tools 容器

```bash
mkdir -p /home/yx-tools-web && cd /home/yx-tools-web

docker run -d --name cf-speedtest \
  -v /home/yx-tools-web/data:/app/data \
  -v /home/yx-tools-web/config:/app/config \
  --restart unless-stopped \
  ghcr.nju.edu.cn/1williamaoayers/yx-tools:latest
```

#### 2. 克隆项目并构建

```bash
# 克隆项目
git clone https://github.com/你的用户名/yx-tools-web.git
cd yx-tools-web

# 构建镜像
docker build -t yx-tools-web ./web

# 运行 Web 面板
docker run -d --name yx-tools-web \
  -p 2030:5000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /home/yx-tools-web/data:/data \
  -v /home/yx-tools-web/config:/config \
  -e CONTAINER_NAME=cf-speedtest \
  --restart unless-stopped \
  yx-tools-web
```

#### 3. 访问面板

打开浏览器访问: http://你的IP:2030

## 📁 目录结构

```
yx-tools-web/
├── web/
│   ├── app.py              # Flask 后端
│   ├── Dockerfile          # Web 容器镜像
│   ├── requirements.txt    # Python 依赖
│   ├── templates/
│   │   └── index.html      # 主页面
│   └── static/
│       ├── style.css       # 样式
│       └── app.js          # 前端逻辑
├── data/                   # 共享：测速结果
├── config/                 # 共享：配置文件
└── README.md
```

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CONTAINER_NAME` | cf-speedtest | yx-tools 容器名称 |
| `DATA_DIR` | /data | 数据目录（容器内路径）|
| `CONFIG_DIR` | /config | 配置目录（容器内路径）|

## 🔒 安全提示

- Web 面板挂载了 Docker socket，请勿暴露到公网
- 建议通过 Nginx 反向代理 + 认证保护

## 🤖 自动构建

项目配置了 GitHub Actions 自动构建：
- 推送到 `main` 或 `master` 分支时自动触发
- 修改 `web/` 目录下文件时自动触发
- 构建完成后推送到 GitHub Container Registry
- 镜像地址: `ghcr.nju.edu.cn/你的用户名/yx-tools-web:latest`

### 手动触发构建

1. 进入 GitHub 仓库
2. 点击 `Actions` 标签
3. 选择 `构建并推送 Docker 镜像` workflow
4. 点击 `Run workflow` 按钮

### 查看构建状态

在仓库首页可以看到构建状态徽章，点击可查看详细日志。

## 📜 许可证

MIT
