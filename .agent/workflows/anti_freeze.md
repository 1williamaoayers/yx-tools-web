---
description: 异步操作与防卡死最佳实践指南
---

# 🛡️ 异步操作与防卡死指南 (Anti-Freeze Guide)

本工作流用于指导如何安全地执行长耗时任务，防止 Agent 因等待命令结束而超时"卡死"。

## 1. 核心原则
- **Always Detach**: 永远不要在前台运行服务器。
- **Snapshot Only**: 永远不要 `fail -f` (跟随) 日志。
- **Async Tooling**: 利用工具的异步能力。

## 2. 场景化操作指南

### A. 启动 Docker 容器
**❌ 错误做法**:
```bash
docker-compose up
# 导致卡死：Agent 会一直等待容器退出，但容器设计为一直运行。
```

**✅ 正确做法**:
```bash
docker-compose up -d
# 立即返回：容器转入后台，Agent 立即获得控制权。
```

### B. 查看实时日志
**❌ 错误做法**:
```bash
docker logs -f my-container
# 导致卡死：流式输出永远不会停止。
```

**✅ 正确做法**:
```bash
docker logs --tail 50 my-container
# 立即返回：只看最后 50 行并立即结束连接。
```

### C. 运行长耗时脚本 (如构建/安装)
当你使用 `run_command` 工具时：

1. **设置超时阈值**:
   将 `WaitMsBeforeAsync` 设置为 `1000` (1秒)。

2. **行为预期**:
   - 如果命令在 1秒内完成 -> 你会直接得到 Output。
   - 如果命令超过 1秒 -> 你会得到一个 `CommandId`。

3. **后续监控 (如果你拿到了 CommandId)**:
   不要傻等，使用 `command_status` 工具：
   ```json
   {
     "CommandId": "你的CommandId",
     "WaitDurationSeconds": 5  // 只看一眼状态，最多等5秒
   }
   ```
   *循环此步骤直到 Status 变为 DONE。*

## 3. 紧急救援
如果你发现自己不小心运行了一个阻塞命令（导致没有返回）：
- 下一轮对话中，立即运行新的命令来终止它（如果可能）。
- 或者请求用户强制刷新/重启会话。
