# Web 管理面板容器
FROM python:3.11-slim

WORKDIR /app

# 优化：只从官方镜像复制 docker 客户端二进制文件 (大幅减小体积)
# 相比安装 docker.io (含服务端)，这能节省约 150MB+ 空间
COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]
