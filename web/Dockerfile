# Web 管理面板容器
FROM python:3.11-slim

WORKDIR /app

# 安装 Docker CLI（用于执行 docker exec）
RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]
