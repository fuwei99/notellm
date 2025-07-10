// 全局变量
let cookies = [];
let authToken = '';
let currentUser = null;

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否已登录
    checkLoginStatus();
    
    // 绑定登录表单事件
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', debounce(updateUI, 250));
});

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 检查登录状态
function checkLoginStatus() {
    const savedSession = localStorage.getItem('adminSession');
    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            // 检查会话是否过期（24小时）
            if (new Date().getTime() - session.timestamp < 24 * 60 * 60 * 1000) {
                currentUser = session.user;
                authToken = session.token;
                showMainContent();
                return;
            }
        } catch (e) {
            console.error('Invalid session data');
        }
    }
    
    // 检查记住的用户名
    const rememberedUser = localStorage.getItem('rememberedUser');
    if (rememberedUser) {
        document.getElementById('username').value = rememberedUser;
        document.getElementById('remember').checked = true;
    }
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    
    // 显示加载状态
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>登录中...';
    submitBtn.disabled = true;
    
    try {
        // 发送登录请求
        const response = await fetch('/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // 登录成功
            currentUser = result.user;
            authToken = result.token;
            
            // 保存会话
            const session = {
                user: currentUser,
                token: authToken,
                timestamp: new Date().getTime()
            };
            localStorage.setItem('adminSession', JSON.stringify(session));
            
            // 记住用户名
            if (remember) {
                localStorage.setItem('rememberedUser', username);
            } else {
                localStorage.removeItem('rememberedUser');
            }
            
            // 隐藏错误提示
            document.getElementById('loginError').style.display = 'none';
            
            // 显示主内容
            showMainContent();
        } else {
            // 登录失败
            document.getElementById('loginErrorText').textContent = result.message || '用户名或密码错误';
            document.getElementById('loginError').style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        document.getElementById('loginErrorText').textContent = '登录失败，请稍后重试';
        document.getElementById('loginError').style.display = 'block';
    } finally {
        // 恢复按钮状态
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// 显示主内容
function showMainContent() {
    // 隐藏登录页面
    document.getElementById('loginContainer').style.display = 'none';
    
    // 显示主内容
    document.getElementById('mainContent').style.display = 'block';
    
    // 更新用户信息
    if (currentUser) {
        document.getElementById('currentUser').textContent = currentUser.username;
        document.getElementById('userAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
    }
    
    // 初始化主页面
    initMainPage();
}

// 初始化主页面
function initMainPage() {
    // 更新时间
    updateTime();
    setInterval(updateTime, 1000);
    
    // 加载Cookie数据
    loadCookies();
    
    // 定期刷新数据
    setInterval(loadCookies, 30000); // 每30秒刷新一次
}

// 退出登录
function logout() {
    if (confirm('确定要退出登录吗？')) {
        // 清除会话
        localStorage.removeItem('adminSession');
        currentUser = null;
        authToken = '';
        
        // 重新加载页面
        window.location.reload();
    }
}

// 更新时间
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = timeString;
    }
}

// 显示加载动画
function showLoading() {
    document.querySelector('.loading-spinner').classList.add('active');
}

// 隐藏加载动画
function hideLoading() {
    document.querySelector('.loading-spinner').classList.remove('active');
}

// 显示提示消息
function showToast(message, type = 'success') {
    const toastHtml = `
        <div class="toast align-items-center text-white bg-${type} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    const toastContainer = document.querySelector('.toast-container');
    const toastElement = document.createElement('div');
    toastElement.innerHTML = toastHtml;
    toastContainer.appendChild(toastElement);
    
    const toast = new bootstrap.Toast(toastElement.querySelector('.toast'));
    toast.show();
    
    setTimeout(() => {
        toastElement.remove();
    }, 5000);
}

// 添加日志
function addLog(message, type = 'info') {
    const logContainer = document.getElementById('logContainer');
    if (!logContainer) return; // 移动端可能没有日志容器
    
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry mb-2 p-2 rounded bg-light`;
    logEntry.innerHTML = `
        <small class="text-muted">[${timestamp}]</small> 
        <span class="text-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'dark'}">${message}</span>
    `;
    
    // 清空默认提示
    if (logContainer.querySelector('.text-center')) {
        logContainer.innerHTML = '';
    }
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// 加载Cookie数据
async function loadCookies() {
    try {
        const response = await fetch('/cookies/status', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                // 认证失败，重新登录
                localStorage.removeItem('adminSession');
                window.location.reload();
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        cookies = data.cookies || [];
        
        updateUI();
        addLog('成功加载Cookie数据', 'success');
    } catch (error) {
        console.error('加载Cookie失败:', error);
        showToast('加载Cookie数据失败', 'danger');
        addLog(`加载Cookie失败: ${error.message}`, 'error');
    }
}

// 更新UI
function updateUI() {
    // 更新统计信息
    const totalCookies = cookies.length;
    const activeCookies = cookies.filter(c => c.valid && c.enabled).length;
    const threadIdCount = cookies.filter(c => c.threadId).length;
    
    document.getElementById('totalCookies').textContent = totalCookies;
    document.getElementById('activeCookies').textContent = activeCookies;
    document.getElementById('threadIdCount').textContent = threadIdCount;
    
    // 更新表格
    const tbody = document.getElementById('cookieTableBody');
    const emptyState = document.getElementById('emptyCookieState');
    
    if (cookies.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        
        // 检测是否为移动设备
        const isMobile = window.innerWidth <= 768;
        
        tbody.innerHTML = cookies.map((cookie, index) => {
            if (isMobile) {
                // 移动端简化表格
                return `
                    <tr class="cookie-item ${!cookie.enabled ? 'opacity-50' : ''}" data-index="${index}">
                        <td>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" 
                                    ${cookie.enabled ? 'checked' : ''} 
                                    onchange="toggleCookieEnabled('${cookie.userId}', this.checked)"
                                    title="${cookie.enabled ? '点击禁用' : '点击启用'}">
                            </div>
                        </td>
                        <td>${index + 1}</td>
                        <td>
                            <div>
                                <code style="font-size: 0.75rem; word-break: break-all;">${cookie.userId.substring(0, 8)}...</code>
                                ${cookie.threadId ? '<br><small class="text-muted" style="font-size: 0.7rem;"><i class="bi bi-link-45deg"></i> Thread已配置</small>' : ''}
                            </div>
                        </td>
                        <td>
                            <div>
                                ${cookie.valid 
                                    ? '<span class="badge bg-success" style="font-size: 0.7rem;"><i class="bi bi-check-circle"></i> 有效</span>' 
                                    : '<span class="badge bg-danger" style="font-size: 0.7rem;"><i class="bi bi-x-circle"></i> 无效</span>'}
                                ${!cookie.enabled 
                                    ? '<br><span class="badge bg-warning mt-1" style="font-size: 0.7rem;"><i class="bi bi-pause-circle"></i> 禁用</span>' 
                                    : ''}
                            </div>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-outline-primary p-1" onclick="showMobileActions(${index})" title="更多操作">
                                    <i class="bi bi-three-dots-vertical" style="font-size: 0.875rem;"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                // 桌面端完整表格
                return `
                    <tr class="cookie-item ${!cookie.enabled ? 'opacity-50' : ''}">
                        <td>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" 
                                    ${cookie.enabled ? 'checked' : ''} 
                                    onchange="toggleCookieEnabled('${cookie.userId}', this.checked)"
                                    title="${cookie.enabled ? '点击禁用' : '点击启用'}">
                            </div>
                        </td>
                        <td>${index + 1}</td>
                        <td>
                            <code>${cookie.userId}</code>
                        </td>
                        <td class="mobile-hide">
                            <code>${cookie.spaceId}</code>
                        </td>
                        <td class="mobile-hide">
                            <code class="text-muted small">${cookie.cookiePreview || '***'}</code>
                        </td>
                        <td>
                            ${cookie.valid 
                                ? '<span class="badge bg-success"><i class="status-indicator status-active"></i>有效</span>' 
                                : '<span class="badge bg-danger"><i class="status-indicator status-inactive"></i>无效</span>'}
                            ${!cookie.enabled 
                                ? '<span class="badge bg-warning ms-1">已禁用</span>' 
                                : ''}
                        </td>
                        <td class="mobile-hide">${cookie.lastUsed || '从未使用'}</td>
                        <td class="mobile-hide">
                            ${cookie.threadId 
                                ? `<code>${cookie.threadId.substring(0, 12)}...</code>`
                                : '<span class="text-muted">未设置</span>'}
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-outline-primary" onclick="editThreadId(${index})" title="编辑Thread ID">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteCookie(${index})" title="删除">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }).join('');
    }
}

// 移动端操作菜单
function showMobileActions(index) {
    const cookie = cookies[index];
    
    // 创建操作菜单模态框
    const modalHtml = `
        <div class="modal fade" id="mobileActionsModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered modal-sm">
                <div class="modal-content">
                    <div class="modal-header">
                        <h6 class="modal-title">操作菜单</h6>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="list-group list-group-flush">
                            <button class="list-group-item list-group-item-action d-flex align-items-center" onclick="editThreadId(${index}); bootstrap.Modal.getInstance(document.getElementById('mobileActionsModal')).hide();">
                                <i class="bi bi-pencil text-primary me-3"></i>
                                <div>
                                    <div class="fw-semibold">编辑Thread ID</div>
                                    <small class="text-muted">${cookie.threadId ? '修改已有的Thread ID' : '设置新的Thread ID'}</small>
                                </div>
                            </button>
                            <button class="list-group-item list-group-item-action d-flex align-items-center" onclick="viewCookieDetails(${index}); bootstrap.Modal.getInstance(document.getElementById('mobileActionsModal')).hide();">
                                <i class="bi bi-info-circle text-info me-3"></i>
                                <div>
                                    <div class="fw-semibold">查看详情</div>
                                    <small class="text-muted">查看Cookie完整信息</small>
                                </div>
                            </button>
                            <button class="list-group-item list-group-item-action d-flex align-items-center text-danger" onclick="deleteCookie(${index}); bootstrap.Modal.getInstance(document.getElementById('mobileActionsModal')).hide();">
                                <i class="bi bi-trash me-3"></i>
                                <div>
                                    <div class="fw-semibold">删除Cookie</div>
                                    <small class="text-muted">此操作不可恢复</small>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除旧的模态框
    const oldModal = document.getElementById('mobileActionsModal');
    if (oldModal) {
        oldModal.remove();
    }
    
    // 添加新模态框
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('mobileActionsModal'));
    modal.show();
}

// 查看Cookie详情（移动端）
function viewCookieDetails(index) {
    const cookie = cookies[index];
    
    const detailsHtml = `
        <div class="modal fade" id="cookieDetailsModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Cookie详情</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <dl class="row mb-0">
                            <dt class="col-4">用户ID:</dt>
                            <dd class="col-8"><code class="text-break">${cookie.userId}</code></dd>
                            
                            <dt class="col-4">空间ID:</dt>
                            <dd class="col-8"><code class="text-break">${cookie.spaceId}</code></dd>
                            
                            <dt class="col-4">状态:</dt>
                            <dd class="col-8">
                                ${cookie.valid ? '<span class="badge bg-success">有效</span>' : '<span class="badge bg-danger">无效</span>'}
                                ${!cookie.enabled ? ' <span class="badge bg-warning">已禁用</span>' : ''}
                            </dd>
                            
                            <dt class="col-4">Thread ID:</dt>
                            <dd class="col-8">${cookie.threadId ? `<code class="text-break">${cookie.threadId}</code>` : '<span class="text-muted">未设置</span>'}</dd>
                            
                            <dt class="col-4">最后使用:</dt>
                            <dd class="col-8">${cookie.lastUsed || '从未使用'}</dd>
                            
                            <dt class="col-4">Cookie预览:</dt>
                            <dd class="col-8"><code class="text-break small">${cookie.cookiePreview || '***'}</code></dd>
                        </dl>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">关闭</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除旧的模态框
    const oldModal = document.getElementById('cookieDetailsModal');
    if (oldModal) {
        oldModal.remove();
    }
    
    // 添加新模态框
    document.body.insertAdjacentHTML('beforeend', detailsHtml);
    
    // 显示模态框
    const modal = new bootstrap.Modal(document.getElementById('cookieDetailsModal'));
    modal.show();
}

// 切换Cookie启用状态
async function toggleCookieEnabled(userId, enabled) {
    try {
        const response = await fetch(`/cookies/${userId}/toggle`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ enabled })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 更新本地数据
        const cookie = cookies.find(c => c.userId === userId);
        if (cookie) {
            cookie.enabled = enabled;
        }
        
        // 更新UI
        updateUI();
        
        showToast(`Cookie已${enabled ? '启用' : '禁用'}`, 'success');
        addLog(`${enabled ? '启用' : '禁用'}了用户 ${userId} 的Cookie`, 'info');
    } catch (error) {
        console.error('切换Cookie状态失败:', error);
        showToast('切换Cookie状态失败', 'danger');
        addLog(`切换Cookie状态失败: ${error.message}`, 'error');
        
        // 恢复原状态
        await loadCookies();
    }
}

// 刷新Cookie状态
async function refreshCookies() {
    showLoading();
    addLog('正在刷新Cookie状态...');
    
    try {
        const response = await fetch('/cookies/refresh', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        await loadCookies();
        showToast('Cookie状态已刷新', 'success');
        addLog('Cookie状态刷新成功', 'success');
    } catch (error) {
        console.error('刷新失败:', error);
        showToast('刷新Cookie状态失败', 'danger');
        addLog(`刷新失败: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// 添加Cookie
async function addCookie() {
    const cookieContent = document.getElementById('cookieContent').value.trim();
    const threadId = document.getElementById('cookieThreadId').value.trim();
    
    if (!cookieContent) {
        showToast('请输入Cookie内容', 'warning');
        return;
    }
    
    showLoading();
    addLog('正在添加新Cookie...');
    
    try {
        const response = await fetch('/cookies/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                cookies: cookieContent,
                threadId: threadId || undefined
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error?.message || `HTTP error! status: ${response.status}`);
        }
        
        // 显示详细结果
        console.log('添加Cookie结果:', result);
        
        // 关闭模态框
        bootstrap.Modal.getInstance(document.getElementById('addCookieModal')).hide();
        
        // 清空表单
        document.getElementById('cookieContent').value = '';
        document.getElementById('cookieThreadId').value = '';
        
        // 重新加载数据
        await loadCookies();
        
        // 显示详细的结果信息
        if (result.added > 0) {
            showToast(`成功添加 ${result.added} 个Cookie`, 'success');
            addLog(`成功添加 ${result.added} 个Cookie`, 'success');
        } else if (result.failed > 0) {
            showToast(`添加失败: ${result.failed} 个Cookie无效`, 'danger');
            addLog(`添加失败: ${result.failed} 个Cookie无效`, 'error');
            
            // 如果有错误详情，显示它们
            if (result.errors && result.errors.length > 0) {
                result.errors.forEach(error => {
                    addLog(`错误详情: ${error}`, 'error');
                });
            }
        } else {
            showToast('未添加任何Cookie', 'warning');
            addLog('未添加任何Cookie', 'warning');
        }
    } catch (error) {
        console.error('添加Cookie失败:', error);
        showToast(`添加Cookie失败: ${error.message}`, 'danger');
        addLog(`添加Cookie失败: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// 编辑Thread ID
function editThreadId(index) {
    const cookie = cookies[index];
    
    document.getElementById('editCookieIndex').value = index;
    document.getElementById('editUserId').value = cookie.userId;
    document.getElementById('editThreadId').value = cookie.threadId || '';
    
    const modal = new bootstrap.Modal(document.getElementById('editThreadIdModal'));
    modal.show();
}

// 保存Thread ID
async function saveThreadId() {
    const index = parseInt(document.getElementById('editCookieIndex').value);
    const threadId = document.getElementById('editThreadId').value.trim();
    const cookie = cookies[index];
    
    showLoading();
    addLog(`正在更新用户 ${cookie.userId} 的Thread ID...`);
    
    try {
        const response = await fetch('/cookies/thread', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                userId: cookie.userId,
                threadId: threadId || null
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 关闭模态框
        bootstrap.Modal.getInstance(document.getElementById('editThreadIdModal')).hide();
        
        // 重新加载数据
        await loadCookies();
        
        showToast('Thread ID已更新', 'success');
        addLog(`成功更新用户 ${cookie.userId} 的Thread ID`, 'success');
    } catch (error) {
        console.error('更新Thread ID失败:', error);
        showToast('更新Thread ID失败', 'danger');
        addLog(`更新Thread ID失败: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// 删除Cookie
async function deleteCookie(index) {
    const cookie = cookies[index];
    
    if (!confirm(`确定要删除用户 ${cookie.userId} 的Cookie吗？`)) {
        return;
    }
    
    showLoading();
    addLog(`正在删除用户 ${cookie.userId} 的Cookie...`);
    
    try {
        const response = await fetch(`/cookies/${cookie.userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 重新加载数据
        await loadCookies();
        
        showToast('Cookie已删除', 'success');
        addLog(`成功删除用户 ${cookie.userId} 的Cookie`, 'success');
    } catch (error) {
        console.error('删除Cookie失败:', error);
        showToast('删除Cookie失败', 'danger');
        addLog(`删除Cookie失败: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// 导出功能（可选）
function exportCookies() {
    const dataStr = JSON.stringify(cookies, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `cookies_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showToast('Cookie数据已导出', 'success');
    addLog('导出Cookie数据', 'info');
}

// 触摸事件优化
if ('ontouchstart' in window) {
    document.addEventListener('touchstart', function() {}, {passive: true});
}
