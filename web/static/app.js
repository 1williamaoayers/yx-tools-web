// yx-tools Professional Dashboard V7
// Full-featured management panel

let isRunning = false;
let uploadHistory = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupNavigation();
    setupEventListeners();
    await loadConfig();
    await fetchResults();
    await checkCronStatus();

    startPolling();

    // Load upload history from localStorage
    loadUploadHistory();

    // Show toast after initialization
    showToast('系统初始化完成', 'success');
}

// === Navigation ===
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = link.dataset.page;

            // Update active nav
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update active page
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${targetPage}`).classList.add('active');
        });
    });

    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Quick action navigation
    document.getElementById('btn-view-results')?.addEventListener('click', () => {
        navigateToPage('results');
    });

    document.getElementById('btn-view-logs')?.addEventListener('click', () => {
        navigateToPage('logs');
    });
}

function navigateToPage(pageName) {
    const link = document.querySelector(`.nav-link[data-page="${pageName}"]`);
    if (link) link.click();
}

// === Event Listeners ===
function setupEventListeners() {
    // Mode change
    document.getElementById('mode').addEventListener('change', handleModeChange);

    // Upload method change
    document.querySelectorAll('input[name="upload_method"]').forEach(radio => {
        radio.addEventListener('change', handleUploadMethodChange);
    });

    // Quick run button
    document.getElementById('btn-run-quick').addEventListener('click', runSpeedtest);

    // Config form
    document.getElementById('config-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveConfig();
    });

    // Reset config
    document.getElementById('btn-reset-config')?.addEventListener('click', resetConfig);

    // Cron button
    document.getElementById('btn-set-cron').addEventListener('click', setCronJob);

    // File upload
    document.getElementById('proxy-file')?.addEventListener('change', (e) => {
        const fileName = e.target.files[0]?.name || '未选择文件';
        document.getElementById('file-name').textContent = fileName;
    });

    document.getElementById('btn-upload')?.addEventListener('click', uploadProxyFile);

    // Refresh buttons
    document.getElementById('btn-refresh-results')?.addEventListener('click', fetchResults);

    // Clear logs
    document.getElementById('btn-clear-logs')?.addEventListener('click', clearLogs);

    // Initialize visibility
    handleModeChange();
    handleUploadMethodChange();
}

// === Dynamic Fields ===
function handleModeChange() {
    const mode = document.getElementById('mode').value;

    document.getElementById('field-region').style.display =
        mode === 'normal' ? 'block' : 'none';

    document.getElementById('field-proxy-file').style.display =
        mode === 'proxy' ? 'block' : 'none';
}

function handleUploadMethodChange() {
    const method = document.querySelector('input[name="upload_method"]:checked').value;

    document.getElementById('field-upload-api').style.display =
        method === 'api' ? 'block' : 'none';

    document.getElementById('field-upload-github').style.display =
        method === 'github' ? 'block' : 'none';

    document.getElementById('field-upload-common').style.display =
        method !== 'none' ? 'block' : 'none';
}

// === Configuration ===
async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();

        if (data.success) {
            const config = data.config;

            // Set form values
            setValue('mode', config.mode);
            setValue('region', config.region);
            setValue('speed', config.speed);
            setValue('count', config.count);
            setValue('delay', config.delay);
            setValue('thread', config.thread);
            // Reconstruct Worker URLs for display
            if (config.worker_domains && config.uuids) {
                const domains = config.worker_domains.split(',');
                const uuids = config.uuids.split(',');
                const urls = domains.map((d, i) => {
                    const uuid = uuids[i] || '';
                    if (!d) return '';
                    let domain = d.trim();
                    // If domain doesn't have protocol, add it for display
                    if (!domain.startsWith('http')) domain = 'https://' + domain;
                    if (domain.endsWith('/')) domain = domain.slice(0, -1);
                    return `${domain}/${uuid}`;
                }).filter(u => u).join(',\n');
                setValue('worker_url_input', urls);
            }

            setValue('worker_domains', config.worker_domains);
            setValue('uuids', config.uuids);
            setValue('github_token', config.github_token);
            setValue('repo', config.repo);
            setValue('file_path', config.file_path);
            setValue('upload_count', config.upload_count);
            setValue('cron-schedule', config.cron_schedule);

            // Checkboxes
            setChecked('ipv6', config.ipv6);
            setChecked('clear', config.clear);

            // Radio
            if (config.upload_method) {
                const radio = document.querySelector(`input[name="upload_method"][value="${config.upload_method}"]`);
                if (radio) radio.checked = true;
            }

            handleModeChange();
            handleUploadMethodChange();
        }
    } catch (error) {
        console.error('Failed to load config:', error);
        showToast('加载配置失败', 'error');
    }
}

async function saveConfig() {
    const config = getFormData();

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        const data = await res.json();

        if (data.success) {
            showToast('配置保存成功', 'success');
        } else {
            showToast('配置保存失败', 'error');
        }
    } catch (error) {
        console.error('Failed to save config:', error);
        showToast('配置保存失败', 'error');
    }
}

function resetConfig() {
    if (confirm('确定要重置所有配置为默认值吗？')) {
        // Reset to defaults
        setValue('mode', 'normal');
        setValue('region', '');
        setValue('speed', 5);
        setValue('count', 10);
        setValue('delay', 300);
        setValue('thread', 200);
        setValue('upload_count', 10);
        setChecked('ipv6', false);
        setChecked('clear', false);
        document.querySelector('input[name="upload_method"][value="none"]').checked = true;

        handleModeChange();
        handleUploadMethodChange();

        showToast('配置已重置', 'info');
    }
}

// === Speed Test ===
async function runSpeedtest() {
    if (isRunning) {
        showToast('测速正在进行中，请稍候', 'info');
        return;
    }

    const config = getFormData();

    try {
        const res = await fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        const data = await res.json();

        if (data.success) {
            showToast('测速任务已启动', 'success');
            appendLog('> 测速任务已启动，正在执行...');

            // Navigate to logs page
            navigateToPage('logs');
        } else {
            showToast(data.message || '启动失败', 'error');
        }
    } catch (error) {
        console.error('Failed to start speedtest:', error);
        showToast('启动失败', 'error');
    }
}

// === Results ===
async function fetchResults() {
    try {
        const res = await fetch('/api/results');
        const data = await res.json();

        if (data.success && data.data.length > 0) {
            updateResultsTable(data.data);
            updateDashboardPreview(data.data.slice(0, 5));
            document.getElementById('results-count').textContent = `${data.count} 条记录`;

            // Update last run time
            if (data.last_update) {
                document.getElementById('dash-last-run').textContent = data.last_update;
            }
        } else {
            clearResultsTable();
        }
    } catch (error) {
        console.error('Failed to fetch results:', error);
    }
}

function updateResultsTable(results) {
    const tbody = document.getElementById('results-table-body');
    tbody.innerHTML = results.map(row => `
        <tr>
            <td>${row.ip}</td>
            <td>${row.speed}</td>
            <td>${row.latency}</td>
            <td>${row.region}</td>
        </tr>
    `).join('');
}

function updateDashboardPreview(results) {
    const tbody = document.getElementById('dash-results-preview');
    if (results.length > 0) {
        tbody.innerHTML = results.map(row => `
            <tr>
                <td>${row.ip}</td>
                <td>${row.speed}</td>
                <td>${row.latency}</td>
                <td>${row.region}</td>
            </tr>
        `).join('');
    }
}

function clearResultsTable() {
    document.getElementById('results-table-body').innerHTML =
        '<tr><td colspan="4" class="text-center text-muted">暂无测速数据</td></tr>';
    document.getElementById('dash-results-preview').innerHTML =
        '<tr><td colspan="4" class="text-center text-muted">暂无数据</td></tr>';
    document.getElementById('results-count').textContent = '0 条记录';
}

// === File Upload ===
async function uploadProxyFile() {
    const fileInput = document.getElementById('proxy-file');
    const file = fileInput.files[0];

    if (!file) {
        showToast('请先选择文件', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (data.success) {
            showToast('文件上传成功', 'success');
            document.getElementById('csv_file').value = data.filename;
        } else {
            showToast(data.message || '上传失败', 'error');
        }
    } catch (error) {
        console.error('Failed to upload file:', error);
        showToast('上传失败', 'error');
    }
}

// === Cron Management ===
async function setCronJob() {
    const schedule = document.getElementById('cron-schedule').value;

    if (!schedule.trim()) {
        showToast('请输入 Cron 表达式', 'error');
        return;
    }

    const config = getFormData();
    config.schedule = schedule;

    try {
        const res = await fetch('/api/cron', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        const data = await res.json();

        if (data.success) {
            showToast('定时任务设置成功', 'success');
            await checkCronStatus();
        } else {
            showToast(data.message || '设置失败', 'error');
        }
    } catch (error) {
        console.error('Failed to set cron:', error);
        showToast('设置失败', 'error');
    }
}

async function checkCronStatus() {
    try {
        const res = await fetch('/api/cron');
        const data = await res.json();

        if (data.success && data.has_cron) {
            const cronText = `已设置：${data.cron}`;
            document.getElementById('cron-status').textContent = cronText;
            document.getElementById('cron-status').style.color = 'var(--color-success)';
            document.getElementById('dash-cron-status').textContent = '已激活';
            document.getElementById('dash-cron-status').style.color = 'var(--color-success)';
        } else {
            document.getElementById('cron-status').textContent = '未激活';
            document.getElementById('cron-status').style.color = 'var(--color-text-muted)';
            document.getElementById('dash-cron-status').textContent = '未设置';
        }
    } catch (error) {
        console.error('Failed to check cron status:', error);
    }
}

// === Logs ===
async function fetchLogs() {
    try {
        const res = await fetch('/api/logs');
        const data = await res.json();

        if (data.success && data.logs) {
            const terminal = document.getElementById('terminal');
            const lines = data.logs.split('\n').filter(l => l.trim());
            terminal.innerHTML = lines.map(line =>
                `<div class="terminal-line">${escapeHtml(line)}</div>`
            ).join('');

            // Auto scroll to bottom
            terminal.scrollTop = terminal.scrollHeight;
        }
    } catch (error) {
        console.error('Failed to fetch logs:', error);
    }
}

function appendLog(message) {
    const terminal = document.getElementById('terminal');
    const line = document.createElement('div');
    line.className = 'terminal-line';
    line.textContent = message;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

async function clearLogs() {
    try {
        const res = await fetch('/api/logs/clear', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            document.getElementById('terminal').innerHTML =
                '<div class="terminal-line">> 日志已清空</div>';
            showToast('日志已清空', 'success');
        }
    } catch (error) {
        console.error('Failed to clear logs:', error);
    }
}

// === Status Polling ===
function startPolling() {
    // Poll status every 2 seconds
    setInterval(async () => {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();

            updateStatus(data.running);

            // If running, fetch logs more frequently
            if (data.running) {
                fetchLogs();
            }
        } catch (error) {
            console.error('Failed to fetch status:', error);
        }
    }, 2000);

    // Poll results every 5 seconds
    setInterval(() => {
        if (!isRunning) {
            fetchResults();
        }
    }, 5000);

    // Poll logs every 1 second
    setInterval(() => {
        fetchLogs();
    }, 1000);
}

function updateStatus(running) {
    isRunning = running;

    const statusDots = [
        document.getElementById('sidebar-status-dot'),
        document.getElementById('mobile-status-dot')
    ];

    const statusTexts = [
        document.getElementById('sidebar-status-text'),
        document.getElementById('dash-status')
    ];

    if (running) {
        statusDots.forEach(dot => {
            if (dot) {
                dot.classList.add('running');
                dot.classList.remove('active');
            }
        });

        statusTexts.forEach(text => {
            if (text) {
                text.textContent = '测速进行中';
                text.style.color = 'var(--color-primary)';
            }
        });

        // Disable run button
        const runBtn = document.getElementById('btn-run-quick');
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">测速中...</span>';
        }
    } else {
        statusDots.forEach(dot => {
            if (dot) {
                dot.classList.remove('running');
                dot.classList.add('active');
            }
        });

        statusTexts.forEach(text => {
            if (text) {
                text.textContent = '就绪';
                text.style.color = 'var(--color-success)';
            }
        });

        // Enable run button
        const runBtn = document.getElementById('btn-run-quick');
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">立即测速</span>';
        }
    }
}

// === Upload History ===
function loadUploadHistory() {
    try {
        const stored = localStorage.getItem('uploadHistory');
        if (stored) {
            uploadHistory = JSON.parse(stored);
            renderUploadHistory();
        }
    } catch (error) {
        console.error('Failed to load upload history:', error);
    }
}

function saveUploadHistory() {
    try {
        localStorage.setItem('uploadHistory', JSON.stringify(uploadHistory));
        renderUploadHistory();
    } catch (error) {
        console.error('Failed to save upload history:', error);
    }
}

function addUploadRecord(method, target, count, status) {
    const record = {
        time: new Date().toLocaleString('zh-CN'),
        method: method,
        target: target,
        count: count,
        status: status
    };

    uploadHistory.unshift(record);

    // Keep only last 50 records
    if (uploadHistory.length > 50) {
        uploadHistory = uploadHistory.slice(0, 50);
    }

    saveUploadHistory();
}

function renderUploadHistory() {
    const tbody = document.getElementById('history-table-body');

    if (uploadHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">暂无上传历史</td></tr>';
        return;
    }

    tbody.innerHTML = uploadHistory.map(record => `
        <tr>
            <td>${record.time}</td>
            <td>${record.method}</td>
            <td>${record.target}</td>
            <td>${record.count}</td>
            <td><span class="badge" style="background: ${record.status === '成功' ? 'var(--color-success)' : 'var(--color-danger)'}20; color: ${record.status === '成功' ? 'var(--color-success)' : 'var(--color-danger)'}">${record.status}</span></td>
        </tr>
    `).join('');
}

// === Toast Notifications ===
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };

    toast.innerHTML = `
        <span style="font-size: 1.25rem;">${icons[type] || icons.info}</span>
        <span style="flex: 1;">${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// === Utilities ===
function setValue(id, value) {
    const el = document.getElementById(id);
    if (el && value !== null && value !== undefined) {
        el.value = value;
    }
}

function setChecked(id, checked) {
    const el = document.getElementById(id);
    if (el) {
        el.checked = !!checked;
    }
}

function getFormData() {
    const form = document.getElementById('config-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Handle checkboxes
    data.ipv6 = document.getElementById('ipv6').checked;
    data.clear = document.getElementById('clear')?.checked || false;

    // Convert numbers
    data.speed = parseFloat(data.speed) || 5;
    data.count = parseInt(data.count) || 10;
    data.delay = parseInt(data.delay) || 300;
    data.thread = parseInt(data.thread) || 200;
    data.upload_count = parseInt(data.upload_count) || 10;

    // Parse Worker URLs
    const urlInput = document.getElementById('worker_url_input')?.value || '';
    if (urlInput.trim()) {
        const urls = urlInput.split(/[\n,]+/).map(u => u.trim()).filter(u => u);
        const domains = [];
        const uuids = [];

        urls.forEach(urlStr => {
            try {
                // Ensure protocol
                if (!urlStr.startsWith('http')) urlStr = 'https://' + urlStr;
                const url = new URL(urlStr);

                // Domain is origin usually, but the CLI seems to expect just the domain part essentially or the full url prefix?
                // The python script does: --worker-domain {domains} --uuid {uuids}
                // Looking at CLI_INTERACTION.md: "https://你的域名/你的UUID"
                // So domain part is "https://你的域名", uuid part is "你的UUID" (path minus leading slash)

                let domain = url.hostname; // example.com (CLI expects no protocol)
                let uuid = url.pathname;
                if (uuid.startsWith('/')) uuid = uuid.substring(1);

                if (domain && uuid) {
                    domains.push(domain);
                    uuids.push(uuid);
                }
            } catch (e) {
                console.warn('Invalid URL:', urlStr);
            }
        });

        data.worker_domains = domains.join(',');
        data.uuids = uuids.join(',');
    } else {
        data.worker_domains = '';
        data.uuids = '';
    }

    return data;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
