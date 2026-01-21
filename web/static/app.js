// yx-tools 管理面板前端逻辑
// 处理 API 调用和页面交互

// ============ 工具函数 ============

// 显示 Toast 通知
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// API 请求封装
async function api(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json'
            },
            ...options
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('网络请求失败', 'error');
        return { success: false, message: error.message };
    }
}

// ============ 状态检查 ============

async function checkStatus() {
    const badge = document.getElementById('status-badge');
    const dot = badge.querySelector('.status-dot');
    const text = badge.querySelector('.status-text');

    const result = await api('/api/status');

    if (result.success && result.running) {
        dot.className = 'status-dot running';
        text.textContent = '运行中';
    } else {
        dot.className = 'status-dot stopped';
        text.textContent = '已停止';
    }
}

// ============ 配置管理 ============

async function loadConfig() {
    const result = await api('/api/config');

    if (result.success && result.config) {
        const config = result.config;
        document.getElementById('mode').value = config.mode || 'beginner';
        document.getElementById('count').value = config.count || 10;
        document.getElementById('region').value = config.region || '';
        document.getElementById('cron-schedule').value = config.cron_schedule || '0 2 * * *';
    }
}

async function saveConfig(event) {
    event.preventDefault();

    const config = {
        mode: document.getElementById('mode').value,
        count: parseInt(document.getElementById('count').value),
        region: document.getElementById('region').value,
        cron_schedule: document.getElementById('cron-schedule').value
    };

    const result = await api('/api/config', {
        method: 'POST',
        body: JSON.stringify(config)
    });

    if (result.success) {
        showToast('配置已保存', 'success');
    } else {
        showToast(result.message || '保存失败', 'error');
    }
}

// ============ 定时任务 ============

async function loadCron() {
    const statusEl = document.getElementById('cron-status');
    const valueEl = statusEl.querySelector('.cron-value');

    const result = await api('/api/cron');

    if (result.success) {
        if (result.has_cron) {
            valueEl.textContent = result.cron.trim().substring(0, 50) + '...';
        } else {
            valueEl.textContent = '未设置';
        }
    } else {
        valueEl.textContent = '获取失败';
    }
}

async function setCron() {
    const schedule = document.getElementById('cron-schedule').value;
    const btn = document.getElementById('btn-set-cron');

    btn.disabled = true;
    btn.classList.add('loading');

    const result = await api('/api/cron', {
        method: 'POST',
        body: JSON.stringify({ schedule })
    });

    btn.disabled = false;
    btn.classList.remove('loading');

    if (result.success) {
        showToast(result.message, 'success');
        loadCron();
    } else {
        showToast(result.message || '设置失败', 'error');
    }
}

// ============ 测速结果 ============

async function loadResults() {
    const metaEl = document.getElementById('results-meta');
    const bodyEl = document.getElementById('results-body');

    const result = await api('/api/results');

    if (result.success && result.data.length > 0) {
        // 更新元信息
        metaEl.innerHTML = `
            <span>最后更新: ${result.last_update}</span>
            <span>共 ${result.count} 条记录</span>
        `;

        // 渲染表格
        bodyEl.innerHTML = result.data.map(row => `
            <tr>
                <td>${row['IP 地址'] || row.ip || '-'}</td>
                <td>${row['延迟'] || row.latency || '-'}</td>
                <td>${row['下载速度 (MB/s)'] || row.speed || '-'}</td>
                <td>${row['数据中心'] || row.datacenter || '-'}</td>
            </tr>
        `).join('');
    } else {
        metaEl.innerHTML = `
            <span>最后更新: --</span>
            <span>共 0 条记录</span>
        `;
        bodyEl.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">暂无数据，点击"立即测速"开始</td>
            </tr>
        `;
    }
}

// ============ 手动测速 ============

async function runSpeedtest() {
    const btn = document.getElementById('btn-run-test');

    btn.disabled = true;
    btn.classList.add('loading');

    const config = {
        mode: document.getElementById('mode').value,
        count: parseInt(document.getElementById('count').value),
        region: document.getElementById('region').value
    };

    const result = await api('/api/run', {
        method: 'POST',
        body: JSON.stringify(config)
    });

    btn.disabled = false;
    btn.classList.remove('loading');

    if (result.success) {
        showToast(result.message, 'success');
        // 30秒后自动刷新结果
        setTimeout(loadResults, 30000);
    } else {
        showToast(result.message || '启动失败', 'error');
    }
}

// ============ 事件绑定 ============

document.addEventListener('DOMContentLoaded', () => {
    // 加载初始数据
    checkStatus();
    loadConfig();
    loadCron();
    loadResults();

    // 定时刷新状态
    setInterval(checkStatus, 30000);

    // 绑定事件
    document.getElementById('config-form').addEventListener('submit', saveConfig);
    document.getElementById('btn-run-test').addEventListener('click', runSpeedtest);
    document.getElementById('btn-refresh').addEventListener('click', loadResults);
    document.getElementById('btn-set-cron').addEventListener('click', setCron);
});
