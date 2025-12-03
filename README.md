<div align="center">
<h1 align="center">
DouYu-Helper
</h1>

一个基于 GitHub Actions 的斗鱼自动化脚本，支持每日自动领礼物、自定义赠送策略及 Cookie 自动保活。
</div>

## 工具简介
利用 Github Action 的方式实现斗鱼TV自动获取粉丝荧光棒，并完成赠送工具。
**特色功能：支持使用浏览器插件一键同步 Cookie，彻底解决手动抓包的烦恼！**

## 功能列表
* [x] **每周日自动执行** (默认清空所有背包礼物)
* [x] **浏览器插件一键同步 Cookie** (支持自动/手动模式，免抓包)
* [x] 自动获取每日荧光棒
* [x] 自定义赠送的房间与数量 (支持百分比配置，如 `100%`)
* [x] 平均分配荧光棒至拥有粉丝牌的房间
* [x] 支持所有背包礼物赠送 (不仅限于荧光棒)
* [x] 推送日志 (Server酱/Bark)

# 目录
- [目录](#目录)
    - [使用说明](#使用说明)
      - [一、Actions方式](#一、Actions方式(推荐))
        - [1. Fork与配置](#1-Fork与配置)
        - [2. Cookie同步(神器)](#2-Cookie同步(神器))
        - [3. 开启自动运行](#3-开启自动运行)
      - [二、本地执行](#二、本地执行)

## 使用说明

### 一、Actions方式(推荐)

#### 1. Fork与配置
1. **Fork本项目** 到你的仓库。
2. 修改 `config/config.ini` 配置文件，设置你想要赠送的房间号。
   
   *默认配置：每周日清空所有礼物给房间 36252。*

   ```ini
   [Modechoose]
   giveMode = 1  # 1为自定义模式，0为平均分配

   [gift]
   giftType = all # 赠送所有背包礼物

   [selfMode]
   roomId = 36252
   giftCount = 100% # 支持百分比，送光光
   ```

#### 2. Cookie同步(神器)
无需繁琐的手动抓包，使用我们提供的 Tampermonkey 脚本，一键把 Cookie 同步到 GitHub！

1. **获取 GitHub Token**
   * 访问 [GitHub Settings -> Developer settings -> Tokens (classic)](https://github.com/settings/tokens)
   * Generate new token (classic) -> 勾选 `repo` 权限 -> 生成并复制 Token。
2. **安装脚本**
   * 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 插件。
   * 在 Tampermonkey 中添加新脚本，将本项目根目录下的 `tampermonkey_script.js` 内容复制进去并保存。
3. **一键同步**
   * 打开斗鱼网页并登录。
   * 脚本会自动检测，如果是首次使用，点击 Tampermonkey 菜单栏中的 `⚙️ 设置`，输入刚才的 Token 和你的仓库路径 (例如 `yourname/douyu_helper`)。
   * 配置完成后，脚本会自动将 Cookie 上传到你仓库的 `.github/douyu_cookie.txt` 文件中。
   * **日常保活**：以后只要你打开斗鱼看直播，脚本会每天自动静默检查并更新一次 Cookie，彻底解放双手！

#### 3. 开启自动运行
1. **开启 Actions**
   Fork 仓库后，Actions 默认是禁用的。请进入仓库的 Actions 页面，点击 `I understand my workflows, go ahead and enable them`。
2. **手动触发一次**
   在 Actions 页面选择 `Weekly Donate DouYu Gifts` -> `Run workflow`，测试一次是否运行正常。
3. **自动计划**
   默认配置为每周日晚上 23:00 (北京时间) 自动执行。

---

### 二、本地执行

如果你有服务器或长期开机的设备，也可以本地运行。

1. Clone 代码到本地。
2. 安装依赖: `pip install -r requirements.txt`
3. 配置环境变量: `export COOKIES='你的完整cookie字符串'`
4. 运行: `python main.py`

---

### 常见问题

**Q: 为什么要上传文件而不是用 Secrets?**
A: GitHub 的 Secrets API 必须加密上传，这在浏览器脚本中很难稳定实现。我们改为上传到仓库的私有文件，Action 运行时会自动优先读取该文件。**请务必将你的仓库设为 Private (私有)，防止 Cookie 泄露！**

**Q: 自动同步失败怎么办？**
A: 脚本菜单里提供了 `📋 手动粘贴 Cookie` 功能，你可以手动 F12 复制 Cookie 粘贴进去，脚本会帮你完成上传。

请各位使用 Actions 时务必遵守Github条款。不要滥用Actions服务。

Please be sure to abide by the Github terms when using Actions. Do not abuse the Actions service.
