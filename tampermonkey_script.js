// ==UserScript==
// @name         Douyu-Helper Cookie 同步助手 (万能文件版)
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  支持自动读取(尝试绕过HttpOnly)或手动粘贴 Cookie，上传到 GitHub 文件。
// @author       DouyuHelperUser
// @match        https://www.douyu.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_cookie
// @connect      api.github.com
// ==/UserScript==

(function () {
    'use strict';

    const COOKIE_FILE_PATH = '.github/douyu_cookie.txt';

    function utf8_to_b64(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    }

    function showOverlay(message, type = 'info', duration = 0) {
        const old = document.getElementById('dy-helper-overlay');
        if (old) old.remove();
        const overlay = document.createElement('div');
        overlay.id = 'dy-helper-overlay';
        let bgColor = 'rgba(0, 0, 0, 0.85)';
        if (type === 'success') bgColor = 'rgba(46, 125, 50, 0.9)';
        if (type === 'error') bgColor = 'rgba(183, 28, 28, 0.9)';
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: ${bgColor}; z-index: 2147483647; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-family: "Microsoft YaHei", sans-serif; text-align: center; pointer-events: auto;`;
        overlay.innerHTML = `<div style="font-size: 48px; font-weight: bold; margin-bottom: 20px;">🔄 Douyu Helper</div><div style="font-size: 32px; padding: 20px; border: 3px solid white; border-radius: 10px; max-width: 80vw;">${message}</div><div style="margin-top: 30px; font-size: 18px; color: #ddd;">(点击任意处关闭)</div>`;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
        if (duration > 0) setTimeout(() => { if (document.body.contains(overlay)) overlay.remove(); }, duration);
    }

    // 尝试获取所有 Cookie (包括 HttpOnly)
    function getAllCookies() {
        return new Promise((resolve) => {
            if (typeof GM_cookie !== 'undefined') {
                GM_cookie.list({ url: 'https://www.douyu.com/' }, (cookies, error) => {
                    if (!error && cookies) {
                        resolve(cookies.map(c => `${c.name}=${c.value}`).join('; '));
                    } else {
                        resolve(document.cookie); // 降级
                    }
                });
            } else {
                resolve(document.cookie);
            }
        });
    }

    function getFileSha(token, repo, path) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.github.com/repos/${repo}/contents/${path}`,
                headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
                onload: r => {
                    if (r.status === 200) resolve(JSON.parse(r.responseText).sha);
                    else resolve(null);
                },
                onerror: () => resolve(null)
            });
        });
    }

    function putFile(token, repo, path, content, sha) {
        return new Promise((resolve, reject) => {
            const body = {
                message: 'update douyu cookie [skip ci]',
                content: content,
                sha: sha
            };
            GM_xmlhttpRequest({
                method: 'PUT',
                url: `https://api.github.com/repos/${repo}/contents/${path}`,
                headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
                data: JSON.stringify(body),
                onload: r => (r.status === 201 || r.status === 200) ? resolve() : reject(new Error(`上传失败 ${r.status}: ${r.responseText}`)),
                onerror: () => reject(new Error('网络错误'))
            });
        });
    }

    async function runSync(manualCookie = null) {
        const token = GM_getValue('gh_token');
        const repo = GM_getValue('gh_repo');
        if (!token || !repo) { setupConfig(); return; }

        showOverlay('正在处理 Cookie...', 'info');

        try {
            let finalCookie = manualCookie;
            
            if (!finalCookie) {
                finalCookie = await getAllCookies();
            }

            // 放宽检查：只要有 acf_uid 就算登录 (acf_auth 可能是 HttpOnly 读不到)
            if (!finalCookie.includes('acf_uid') && !finalCookie.includes('acf_auth')) {
                 throw new Error('未检测到登录信息 (acf_uid/acf_auth 缺失)。\n请尝试"手动粘贴 Cookie"功能。');
            }

            showOverlay('正在上传 Cookie 文件...', 'info');
            
            const content = utf8_to_b64(finalCookie);
            const sha = await getFileSha(token, repo, COOKIE_FILE_PATH);
            await putFile(token, repo, COOKIE_FILE_PATH, content, sha);

            showOverlay('同步成功！<br>Cookie 已更新', 'success', 3000);
        } catch (e) {
            console.error(e);
            showOverlay(`失败: ${e.message}`, 'error');
        }
    }

    function setupConfig() {
        const t = prompt('GitHub Token:', GM_getValue('gh_token', ''));
        if (!t) return;
        const r = prompt('仓库路径 (例如 david/douyu_helper):', GM_getValue('gh_repo', ''));
        if (!r) return;
        GM_setValue('gh_token', t);
        GM_setValue('gh_repo', r);
        runSync();
    }

    function manualPaste() {
        const c = prompt('请粘贴 F12 获取的完整 Cookie 字符串:');
        if (c && c.trim()) {
            runSync(c.trim());
        }
    }

    GM_registerMenuCommand("🚀 自动同步 Cookie", () => runSync());
    GM_registerMenuCommand("📋 手动粘贴 Cookie 并上传", manualPaste);
    GM_registerMenuCommand("⚙️ 设置 GitHub 信息", setupConfig);
    
    // 延时自动尝试
    setTimeout(() => runSync(), 5000);

})();
