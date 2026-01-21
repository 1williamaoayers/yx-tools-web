import requests
import time

# 模拟点击手动上传后的验证
print("=== 手动上传验证工具 ===\n")

# 1. 检查当前结果文件
print("1. 检查结果文件...")
try:
    with open('data/result.csv', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        print(f"   ✓ result.csv 存在，包含 {len(lines)-1} 条记录")
except:
    print("   ✗ 未找到 result.csv")

# 2. 模拟前端发送上传请求
print("\n2. 发送手动上传请求...")
try:
    resp = requests.post('http://localhost:2030/api/upload/manual', json={
        'worker_domains': 'yx.cdx.hidns.co,joeyblog.up88.qzz.io',
        'uuids': 'ab82c26c-c59b-48ec-8950-dfd67df5c859,9803eff1-883e-40b7-a89f-562de43bbe2c',
        'upload_count': 3,
        'clear': True
    })
    print(f"   ✓ 服务器响应: {resp.status_code} - {resp.text}")
except Exception as e:
    print(f"   ✗ 请求失败: {e}")

# 3. 等待并检查上传日志
print("\n3. 等待上传任务执行 (5秒)...")
time.sleep(5)

try:
    with open('data/upload.log', 'r', encoding='utf-8') as f:
        log = f.read()
        print(f"   ✓ 上传日志已生成 ({len(log)} 字节)")
        print("\n   === 日志内容预览 ===")
        print(log[-500:])  # 显示最后500字符
except:
    print("   ✗ 未生成上传日志 (可能仍在执行)")

print("\n=== 验证完成 ===")
