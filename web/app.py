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
                results.append(row)
        
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

@app.route('/api/run', methods=['POST'])
def run_speedtest():
    """手动触发测速"""
    try:
        # 获取配置
        config = request.json or {}
        mode = config.get('mode', 'beginner')
        count = config.get('count', 10)
        region = config.get('region', '')
        
        # 构建命令
        cmd = f'docker exec {CONTAINER_NAME} python3 /app/cloudflare_speedtest.py --mode {mode} --count {count}'
        if region:
            cmd += f' --region {region}'
        
        # 异步执行（不等待结果）
        subprocess.Popen(cmd, shell=True)
        
        return jsonify({'success': True, 'message': '测速已启动，请稍后刷新查看结果'})
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
        
        # 读取配置构建命令
        config_file = os.path.join(CONFIG_DIR, 'settings.json')
        config = {}
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config = json.load(f)
        
        mode = config.get('mode', 'beginner')
        count = config.get('count', 10)
        
        cron_cmd = f'python3 /app/cloudflare_speedtest.py --mode {mode} --count {count}'
        cron_line = f'{schedule} {cron_cmd}'
        
        # 写入 crontab
        subprocess.run(
            f'docker exec {CONTAINER_NAME} sh -c "echo \'{cron_line}\' | crontab -"',
            shell=True, check=True
        )
        
        return jsonify({'success': True, 'message': f'定时任务已设置: {schedule}'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/api/status')
def get_status():
    """获取容器状态"""
    try:
        result = subprocess.run(
            f'docker inspect {CONTAINER_NAME} --format "{{{{.State.Status}}}}"',
            shell=True, capture_output=True, text=True
        )
        status = result.stdout.strip() if result.returncode == 0 else 'unknown'
        
        return jsonify({
            'success': True,
            'status': status,
            'running': status == 'running'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e), 'running': False})

if __name__ == '__main__':
    # 开发模式
    app.run(host='0.0.0.0', port=5000, debug=True)
