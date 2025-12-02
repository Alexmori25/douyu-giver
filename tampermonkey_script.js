// ==UserScript==
// @name         Douyu-Helper Cookie 同步助手 (菜单版)
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  斗鱼 Cookie 自动同步到 GitHub。使用 Tampermonkey 菜单进行操作，包含巨大的全屏提示确保可见。
// @author       DouyuHelperUser
// @match        https://www.douyu.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        unsafeWindow
// @require      https://unpkg.com/libsodium-wrappers@0.7.15/dist/libsodium-wrappers.min.js
// @connect      api.github.com
// ==/UserScript==

(async function () {
    'use strict';

    const SECRET_NAME = 'COOKIES';
    const AUTO_SYNC_INTERVAL_DAYS = 3;

    // ---------------------------------------------------------
    // libsodium 初始化（允许失败，不直接退出脚本）
    // ---------------------------------------------------------
    let SODIUM = null;
    let SODIUM_READY = false;

    try {
        if (typeof sodium !== 'undefined') {
            await sodium.ready;
            SODIUM = sodium;
            SODIUM_READY = true;
            console.log('[DouyuHelper] libsodium 加载成功');
        } else {
            console.error('[DouyuHelper] Sodium library not found (sodium is undefined)');
        }
    } catch (e) {
        console.error('[DouyuHelper] Sodium init error:', e);
    }

    // ---------------------------------------------------------
    // UI：巨大遮罩层 HUD
    // ---------------------------------------------------------
    function showOverlay(message, type = 'info', duration = 0) {
        const old = document.getElementById('dy-helper-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'dy-helper-overlay';

        let bgColor = 'rgba(0, 0, 0, 0.85)';
        if (type === 'success') bgColor = 'rgba(46, 125, 50, 0.9)';
        if (type === 'error') bgColor = 'rgba(183, 28, 28, 0.9)';

        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: ${bgColor};
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-family: "Microsoft YaHei", sans-serif;
            text-align: center;
            pointer-events: auto;
        `;

        overlay.innerHTML = `
            <div style="font-size: 48px; font-weight: bold; margin-bottom: 20px;">🔄 Douyu Helper</div>
            <div style="font-size: 28px; padding: 20px; border: 3px solid white; border-radius: 10px; max-width: 80vw;">
                ${message}
            </div>
            <div style="margin-top: 30px; font-size: 18px; color: #ddd;">(点击任意处关闭)</div>
        `;

        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);

        if (duration > 0) {
            setTimeout(() => {
                if (document.body.contains(overlay)) overlay.remove();
            }, duration);
        }
    }

    function showStatus() {
        const repo = GM_getValue('gh_repo', '未配置');
        const lastSync = GM_getValue('last_sync_time', 0);
        const lastDate = lastSync ? new Date(lastSync).toLocaleString() : '从未';

        const sodiumStatus = SODIUM_READY ? '✅ 已加载' : '❌ 未加载（无法同步）';

        showOverlay(`
            GitHub 仓库: ${repo}<br>
            上次同步: ${lastDate}<br>
            加密库状态: ${sodiumStatus}<br><br>
            操作：请通过 Tampermonkey 菜单选择功能
        `, 'info');
    }

    // ---------------------------------------------------------
    // 菜单注册（无论 sodium 是否成功都要注册）
    // ---------------------------------------------------------
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('🚀 立即同步 Cookie (手动)', () => runSync(true));
        GM_registerMenuCommand('⚙️ 设置 GitHub 信息', setupConfig);
        GM_registerMenuCommand('❓ 显示帮助/状态', showStatus);
    }

    console.log(
        '%c[DouyuHelper] 脚本已加载。打开直播间后，点击浏览器右上角的 Tampermonkey 图标，在菜单中操作本脚本。',
        'color: #ff5d23; font-size: 16px; font-weight: bold;'
    );

    // 进入直播间几秒后尝试自动同步（后台）
    setTimeout(() => runSync(false), 5000);

    // ---------------------------------------------------------
    // 配置与同步逻辑
    // ---------------------------------------------------------
    function setupConfig() {
        const currentToken = GM_getValue('gh_token', '');
        const currentRepo = GM_getValue('gh_repo', '');

        const newToken = prompt('【1/2】请输入 GitHub Personal Access Token (ghp_...):', currentToken);
        if (newToken === null) return;

        const newRepo = prompt('【2/2】请输入仓库路径 (例如: username/douyu_helper):', currentRepo);
        if (newRepo === null) return;

        GM_setValue('gh_token', newToken);
        GM_setValue('gh_repo', newRepo);

        showOverlay('配置已保存！<br>正在尝试立即同步...', 'info');
        runSync(true);
    }

    async function runSync(isManual = false) {
        const token = GM_getValue('gh_token');
        const repo = GM_getValue('gh_repo');

        // 没配置 GitHub 信息
        if (!token || !repo) {
            if (isManual) {
                setupConfig();
            }
            return;
        }

        // 自动同步频率限制
        const lastSync = GM_getValue('last_sync_time', 0);
        const now = Date.now();
        if (!isManual) {
            const daysSince = (now - lastSync) / (1000 * 60 * 60 * 24);
            if (daysSince < AUTO_SYNC_INTERVAL_DAYS) {
                console.log(`[DouyuHelper] 跳过自动同步 (上次: ${daysSince.toFixed(1)} 天前)`);
                return;
            }
        }

        // 检查加密库
        if (!SODIUM_READY) {
            const msg = `
                加密库 libsodium 未成功加载，无法加密 Cookie，因此不能同步到 GitHub。<br><br>
                可能原因：<br>
                1. 无法访问 unpkg.com CDN（网络/代理/公司防火墙）<br>
                2. 浏览器或隐私扩展拦截了第三方脚本请求<br><br>
                建议尝试：<br>
                - 换一个网络或浏览器（例如 Chrome / Edge 关闭「跟踪防护」）<br>
                - 或者在 Tampermonkey 设置中允许第三方 @require 请求
            `;
            if (isManual) {
                showOverlay(msg, 'error');
            } else if (typeof GM_notification === 'function') {
                GM_notification({
                    title: 'Douyu Helper',
                    text: '自动同步失败：加密库未加载（network/CDN 问题）',
                    timeout: 5000
                });
            }
            console.error('[DouyuHelper] Abort sync: libsodium not ready');
            return;
        }

        if (isManual) showOverlay('正在加密并上传 Cookie...', 'info');

        try {
            if (!document.cookie.includes('acf_auth')) {
                throw new Error('未检测到登录状态 (acf_auth 缺失)，请先登录斗鱼账号');
            }

            await updateSecret(token, repo);

            GM_setValue('last_sync_time', now);
            const msg = `同步成功！<br>${new Date().toLocaleString()}`;

            if (isManual) {
                showOverlay(msg, 'success', 3000);
            } else if (typeof GM_notification === 'function') {
                GM_notification({
                    title: 'Douyu Helper',
                    text: 'Cookie 自动同步成功',
                    timeout: 3000
                });
            }
        } catch (e) {
            console.error('[DouyuHelper] Sync error:', e);
            if (isManual) {
                showOverlay(`同步失败！<br>${e.message}`, 'error');
            } else if (typeof GM_notification === 'function') {
                GM_notification({
                    title: 'Douyu Helper 错误',
                    text: `自动同步失败：${e.message}`,
                    timeout: 5000
                });
            }
        }
    }

    // ---------------------------------------------------------
    // GitHub API
    // ---------------------------------------------------------
    function getPublicKey(token, repo) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.github.com/repos/${repo}/actions/secrets/public-key`,
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                onload: r => {
                    if (r.status === 200) {
                        resolve(JSON.parse(r.responseText));
                    } else {
                        reject(new Error(`获取公钥失败 ${r.status} - ${r.responseText}`));
                    }
                },
                onerror: err => reject(new Error(`获取公钥网络错误: ${err && err.error ? err.error : err}`))
            });
        });
    }

    function putSecret(token, repo, keyId, encryptedValue) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'PUT',
                url: `https://api.github.com/repos/${repo}/actions/secrets/${SECRET_NAME}`,
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({
                    encrypted_value: encryptedValue,
                    key_id: keyId
                }),
                onload: r => {
                    if (r.status === 201 || r.status === 204) {
                        resolve();
                    } else {
                        reject(new Error(`上传失败 ${r.status} - ${r.responseText}`));
                    }
                },
                onerror: err => reject(new Error(`上传网络错误: ${err && err.error ? err.error : err}`))
            });
        });
    }

    async function updateSecret(token, repo) {
        if (!SODIUM_READY || !SODIUM) {
            throw new Error('加密库未就绪，无法更新 GitHub Secret');
        }

        const keyData = await getPublicKey(token, repo);
        const binkey = SODIUM.from_base64(keyData.key, SODIUM.base64_variants.ORIGINAL);
        const binsec = SODIUM.from_string(document.cookie);
        const encBytes = SODIUM.crypto_box_seal(binsec, binkey);
        const encryptedValue = SODIUM.to_base64(encBytes, SODIUM.base64_variants.ORIGINAL);
        await putSecret(token, repo, keyData.key_id, encryptedValue);
    }

})();
