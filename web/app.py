# yx-tools-web 项目架构
# Flask 后端：提供 API 和页面
# 通过 Docker socket 控制 yx-tools 容器
# 通过共享 Volume 读写配置和结果

from flask import Flask, render_template, jsonify, request
import subprocess
import os
import csv
import json
from datetime import datetime

app = Flask(__name__)

# 配置路径（容器内路径）
DATA_DIR = os.environ.get('DATA_DIR', '/data')
CONFIG_DIR = os.environ.get('CONFIG_DIR', '/config')
CONTAINER_NAME = os.environ.get('CONTAINER_NAME', 'cf-speedtest')

# ============ 页面路由 ============

@app.route('/')
def index():
    """主页面"""
    return render_template('index.html')

# ============ API 路由 ============

@app.route('/api/results')
def get_results():
    """获取测速结果"""
    result_file = os.path.join(DATA_DIR, 'result.csv')
    
    if not os.path.exists(result_file):
        return jsonify({'success': False, 'message': '暂无测速结果', 'data': []})
    
    try:
        results = []
        with open(result_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Normalize keys for frontend
                normalized_row = {
                    'ip': row.get('IP 地址', row.get('ip', '')), # Fallback just in case
                    'speed': row.get('下载速度(MB/s)', row.get('speed', '')),
                    'latency': row.get('平均延迟', row.get('latency', '')),
                    'region': row.get('地区码', row.get('region', '')),
                    'loss': row.get('丢包率', '')
                }
                results.append(normalized_row)
        
        # 获取文件修改时间
        mtime = os.path.getmtime(result_file)
        last_update = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
        
        return jsonify({
            'success': True,
            'data': results,
            'last_update': last_update,
            'count': len(results)
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e), 'data': []})

@app.route('/api/config', methods=['GET'])
def get_config():
    """获取当前配置"""
    config_file = os.path.join(CONFIG_DIR, 'settings.json')
    
    # 默认配置
    default_config = {
        'mode': 'beginner',
        'count': 10,
        'region': '',
        'cron_schedule': '0 2 * * *',
        'worker_domains': '',
        'uuids': ''
    }
    
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                # 合并默认配置
                default_config.update(config)
        except:
            pass
    
    return jsonify({'success': True, 'config': default_config})

@app.route('/api/config', methods=['POST'])
def save_config():
    """保存配置"""
    try:
        config = request.json
        config_file = os.path.join(CONFIG_DIR, 'settings.json')
        
        # 确保目录存在
        os.makedirs(CONFIG_DIR, exist_ok=True)
        
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': '配置已保存'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

from werkzeug.utils import secure_filename

# 配置上传路径
UPLOAD_FOLDER = os.path.join(DATA_DIR, 'uploads')
ALLOWED_EXTENSIONS = {'csv', 'txt'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """上传文件 (用于 Proxy 模式的 CSV/TXT)"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '没有文件部分'})
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': '未选择文件'})
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # 确保上传目录存在
        # 注意：这里是在宿主机操作 DATA_DIR，确保映射正确
        # 如果 DATA_DIR 在容器内不可写，可能需要调整
        # 假设 DATA_DIR 是挂载的卷，应该可写
        local_upload_dir = 'data/uploads' # 本地开发环境路径，生产环境可能不同
        if not os.path.exists(local_upload_dir):
            os.makedirs(local_upload_dir)
            
        file_path = os.path.join(local_upload_dir, filename)
        file.save(file_path)
        
        # 复制到容器内 (简单起见，假设容器也挂载了同样的卷)
        # 如果是 web 容器和 tools 容器分离，可能需要通过 docker cp
        # 这里假设共享 volume /data，所以文件应该已经在那了
        # 容器内路径: /data/uploads/<filename>
        
        return jsonify({'success': True, 'message': f'文件已上传: {filename}', 'filename': filename})
    return jsonify({'success': False, 'message': '只允许上传 CSV 或 TXT 文件'})

@app.route('/api/run', methods=['POST'])
def run_speedtest():
    """手动触发测速"""
    try:
        data = request.json or {}
        
        # 基础参数
        mode = data.get('mode', 'beginner')
        ipv6 = data.get('ipv6', False)
        count = data.get('count', 10)
        speed = data.get('speed', 1.0)
        delay = data.get('delay', 1000)
        thread = data.get('thread', 200)
        
        # 智能模式切换: 如果常规模式未指定地区，自动切换回小白模式(全局)
        region = data.get('region', '')
        if mode == 'normal' and not region:
            mode = 'beginner'

        # 构建命令部分的 list
        cmd_parts = [f'docker exec {CONTAINER_NAME} python3 /app/cloudflare_speedtest.py']
        cmd_parts.append(f'--mode {mode}')
        if ipv6: cmd_parts.append('--ipv6')
        cmd_parts.append(f'--count {count}')
        cmd_parts.append(f'--speed {speed}')
        cmd_parts.append(f'--delay {delay}')
        cmd_parts.append(f'--thread {thread}')
        
        # 模式特定参数
        if mode == 'normal' and region:
            cmd_parts.append(f'--region {region}')
        elif mode == 'proxy':
            csv_file = data.get('csv_file', 'result.csv')
            # 如果是上传的文件，路径需要在容器内可见
            # 假设上传文件都在 /data/uploads/ 下
            if csv_file and csv_file != 'result.csv':
                 # 使用容器内路径
                cmd_parts.append(f'--csv /data/uploads/{csv_file}')
            else:
                cmd_parts.append('--csv result.csv')

        # 上传配置
        upload_method = data.get('upload_method', 'none')
        if upload_method != 'none':
            cmd_parts.append(f'--upload {upload_method}')
            cmd_parts.append(f'--upload-count {data.get("upload_count", 10)}')
            if data.get('clear', False):
                cmd_parts.append('--clear')
            
            if upload_method == 'api':
                domains = data.get('worker_domains', '')
                uuids = data.get('uuids', '')
                if domains: cmd_parts.append(f'--worker-domain {domains}')
                if uuids: cmd_parts.append(f'--uuid {uuids}')
            elif upload_method == 'github':
                token = data.get('github_token', '')
                repo = data.get('repo', '')
                file_path = data.get('file_path', 'cloudflare_ips.txt')
                if token: cmd_parts.append(f"--token '{token}'")
                if repo: cmd_parts.append(f'--repo {repo}')
                if file_path: cmd_parts.append(f'--file-path {file_path}')

        full_cmd = " ".join(cmd_parts)
        
        # 重定向输出到日志文件
        log_file = os.path.join(DATA_DIR, 'speedtest.log')
        # 确保日志文件存在
        if not os.path.exists(log_file):
            open(log_file, 'w').close()
            
        final_cmd = f"{full_cmd} > {log_file} 2>&1"
        print(f"Executing: {final_cmd}")
        
        # 异步执行
        subprocess.Popen(final_cmd, shell=True)
        
        return jsonify({'success': True, 'message': '测速已启动，请查看实时日志'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})




@app.route('/api/logs')
def get_logs():
    """获取实时日志"""
    try:
        log_file = os.path.join(DATA_DIR, 'speedtest.log')
        if not os.path.exists(log_file):
            return jsonify({'success': True, 'logs': ''})
            
        # 读取最后 200 行
        # 简单实现：读取整个文件取最后部分 (注意大文件性能，但 log 不会太大)
        with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
            return jsonify({'success': True, 'logs': ''.join(lines[-200:])})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/logs/clear', methods=['POST'])
def clear_logs():
    """清空日志"""
    try:
        log_file = os.path.join(DATA_DIR, 'speedtest.log')
        open(log_file, 'w').close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/cron', methods=['GET'])
def get_cron():
    """获取定时任务状态"""
    try:
        # 读取 crontab
        result = subprocess.run(
            f'docker exec {CONTAINER_NAME} crontab -l',
            shell=True, capture_output=True, text=True
        )
        cron_content = result.stdout if result.returncode == 0 else ''
        
        return jsonify({
            'success': True,
            'cron': cron_content,
            'has_cron': bool(cron_content.strip())
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/cron', methods=['POST'])
def set_cron():
    """设置定时任务"""
    try:
        data = request.json
        schedule = data.get('schedule', '0 2 * * *')
        
        # 复用 run_speedtest 的参数构建逻辑 (简化版，只构建 python 命令部分)
        # 这里需要极其小心，因为 cron 环境和 docker exec 环境不同
        # 实际上我们是往 docker 容器里写 cron
        
        parts = ['python3 /app/cloudflare_speedtest.py']
        
        # 基础参数
        parts.append(f"--mode {data.get('mode', 'beginner')}")
        if data.get('ipv6'): parts.append('--ipv6')
        parts.append(f"--count {data.get('count', 10)}")
        parts.append(f"--speed {data.get('speed', 1.0)}")
        parts.append(f"--delay {data.get('delay', 1000)}")
        parts.append(f"--thread {data.get('thread', 200)}")
        
        # 模式特定
        if data.get('mode') == 'normal':
            parts.append(f"--region {data.get('region', '')}")
        elif data.get('mode') == 'proxy':
             csv_file = data.get('csv_file', 'result.csv')
             if csv_file != 'result.csv':
                 parts.append(f"--csv /data/uploads/{csv_file}")
        
        # 上传配置
        upload_method = data.get('upload_method', 'none')
        if upload_method != 'none':
            parts.append(f"--upload {upload_method}")
            parts.append(f"--upload-count {data.get('upload_count', 10)}")
            if data.get('clear'): parts.append("--clear")
            
            if upload_method == 'api':
                parts.append(f"--worker-domain {data.get('worker_domains', '')}")
                parts.append(f"--uuid {data.get('uuids', '')}")
            elif upload_method == 'github':
                parts.append(f"--token '{data.get('github_token', '')}'")
                parts.append(f"--repo {data.get('repo', '')}")
                parts.append(f"--file-path {data.get('file_path', 'cloudflare_ips.txt')}")

        cmd = " ".join(parts)
        # 添加日志重定向，方便 debug
        cron_line = f"{schedule} {cmd} >> /var/log/speedtest.log 2>&1"
        
        subprocess.run(
            f'docker exec {CONTAINER_NAME} sh -c "echo \'{cron_line}\' | crontab -"',
            shell=True, check=True
        )
        
        return jsonify({'success': True, 'message': f'定时任务已更新'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/status')
def get_status():
    """获取容器状态"""
    try:
        # 检查 Python 测速进程是否存在
        # 注意：容器内可能没有 ps 命令，使用 pidof 检查 python3 进程
        # 但是容器本身可能也是 python 运行的（如果 entrypoint 是 python），所以需要更精确
        # yx-tools 容器是基于 python 镜像的吗？
        # 如果是 tail -f /dev/null 启动的，那么 python3 进程应该只有在测速时才有
        
        check_cmd = f"docker exec {CONTAINER_NAME} pidof python3"
        result = subprocess.run(check_cmd, shell=True, capture_output=True)
        
        is_running = result.returncode == 0
        status = 'running' if is_running else 'idle'
        
        return jsonify({
            'success': True,
            'status': status,
            'running': is_running
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e), 'running': False})

if __name__ == '__main__':
    # 开发模式
    app.run(host='0.0.0.0', port=5000, debug=True)