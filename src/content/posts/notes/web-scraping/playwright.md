---
title: "Playwright"
published: 2026-09-15
updated: 2026-09-15
description: ""
tags: ["学习笔记","爬虫","Playwright"]
category: "爬虫笔记"
draft: false
section: "爬虫笔记"
sectionSlug: "web-scraping"
sectionOrder: 1
sourcePath: "爬虫学习/Playwright.md"
---
## 一、它是什么

Playwright 是微软开发的**浏览器自动化框架**。它控制一个真实的 Chromium/Firefox/WebKit 浏览器，所有操作都和真实用户一样——点击、输入、滚动、执行 JS。

```
pip install playwright
python -m playwright install chromium    # 下载浏览器
```

---

## 二、为什么需要它

对比三种方案：

| 方案 | 原理 | 能不能过 WAF | 速度 |
|---|---|---|---|
| `requests` | 发 HTTP 请求，不执行 JS | ❌ 被 WAF 拦截 | ⚡ 极快 |
| `requests` + 调 API | 找到真实数据接口 | ✅ （如果找得到） | ⚡ 极快 |
| **Playwright** | 控制真实浏览器 | ✅ 真实浏览器，WAF 无法区分 | 🐢 较慢 |

---

## 三、核心概念

Playwright 有三个层级：

```
Playwright（启动器）
    └── Browser（浏览器实例）
            └── Context（隔离的会话，类似隐身窗口）
                    └── Page（标签页）
```

```python
from playwright.sync_api import sync_playwright

# 1. 启动 Playwright
p = sync_playwright().start()

# 2. 启动浏览器
browser = p.chromium.launch(headless=True)

# 3. 创建上下文（可以理解为一个隔离的会话，Cookie 互不影响）
context = browser.new_context()

# 4. 打开一个标签页
page = context.new_page()

# 5. 访问网址
page.goto('https://example.com')

# 6. 操作 + 提取数据
title = page.title()
heading = page.query_selector('h1').inner_text()

# 7. 关闭
browser.close()
p.stop()
```

### 为什么要有 Context？

```
context_a = browser.new_context()  # 登录了账号A
context_b = browser.new_context()  # 登录了账号B

# 两个 context 完全隔离，Cookie 不共用
# 可以同时模拟两个用户，不需要开两个浏览器
```

---

## 四、两种 API：sync vs async

```python
# 同步版本（sync_api）—— 你一直用的
from playwright.sync_api import sync_playwright
# 简单直接，适合爬虫

# 异步版本（async_api）—— 性能更高
from playwright.async_api import async_playwright
# 适合需要同时控制多个浏览器的场景
```

爬虫用同步版本就够。

---

## 五、最常用的操作

### 5.1 导航（打开网页）

```python
# 三种等待策略：
page.goto(url, wait_until='load')              # 默认，等页面全部加载完（包括图片）
page.goto(url, wait_until='domcontentloaded')  # 等 HTML 解析完就返回（推荐，更快）
page.goto(url, wait_until='networkidle')       # 等没有网络请求了再返回（⚠️ 容易卡死）
```

**坑**：`networkidle` 在有些页面会永远等不完（页面一直有请求在轮询），这时候用 `domcontentloaded` + `time.sleep()` 更稳。

### 5.2 查找元素

```python
# 返回单个元素（找不到返回 None）
page.query_selector('.title')
page.query_selector('#id')
page.query_selector('div span a')

# 返回所有匹配的元素（列表）
page.query_selector_all('.item')

# 或者用更强大的 locator API（推荐，自动等待元素出现）
page.locator('.title').first
page.locator('.item').all()
page.locator('text=登录')  # 按文本查找
```

### 5.3 提取数据

```python
# 获取文本
element.inner_text()        # 用户看到的文本（忽略隐藏元素）
element.text_content()      # 所有文本（包括隐藏的）

# 获取属性
element.get_attribute('href')
element.get_attribute('title')

# 获取 HTML
element.inner_html()        # 内部 HTML

# 整个页面的内容
page.content()              # 当前页面的完整 HTML
page.title()                # 页面标题
```

### 5.4 点击和输入

```python
# 点击
page.click('.submit-btn')
element.click()

# 输入文本
page.fill('input[name="username"]', '张三')  # 清空后填入
page.type('input[name="username"]', '张三')  # 模拟打字效果

# 选择下拉框
page.select_option('select#city', '北京')

# 滚动
page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
```

### 5.5 等待

```python
# 固定等待（简单粗暴）
time.sleep(3)                        # 等3秒

# 等待元素出现（更高效）
page.wait_for_selector('.item')      # 等某个元素出现在 DOM 中
page.wait_for_timeout(3000)          # 等固定时间（毫秒）

# 等待网络空闲
page.wait_for_load_state('networkidle')
```

---

## 六、反检测（最容易被忽视但最关键的一环）

### 不加的后果

WAF 检测浏览器是不是自动化工具，通过检查 `navigator.webdriver` 属性。Playwright 控制的浏览器这个属性值是 `true`，真实浏览器是 `undefined`。

### 标准三件套

```python
page.add_init_script('''
    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
    Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
    Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN', 'zh']});
''')
```

这三行在页面加载**任何 JS 之前**就执行，覆盖掉自动化特征。

### 启动参数

```python
browser = p.chromium.launch(
    headless=True,
    args=['--disable-blink-features=AutomationControlled']
)
```

`AutomationControlled` 是 Chrome 的一个标志，加上后隐藏"受自动化控制"的提示。

---

## 七、headless 模式

```python
# 有界面模式 —— 调试时用，能看到浏览器窗口
browser = p.chromium.launch(headless=False)

# 无界面模式 —— 生产环境用，不显示窗口
browser = p.chromium.launch(headless=True)
```

调试技巧：先设 `headless=False`，看浏览器到底在做什么——是验证没通过，还是选择器错了，还是页面根本没加载完。

---

## 八、在页面里执行 JS

这是 Playwright 最强大的功能之一：

```python
# 执行 JS 并获取返回值
result = page.evaluate('1 + 1')                             # → 2
result = page.evaluate('document.title')                    # → 页面标题
result = page.evaluate('window.scrollY')                    # → 滚动位置

# 传参数进去
page.evaluate('(a, b) => a + b', 3, 5)                     # → 8

# 用 fetch 调 API（在页面上下文里，不会被反爬）
result = page.evaluate('''(url) => {
    return fetch(url).then(r => r.json());
}''', 'https://api.example.com/data')
```

**为什么要用 `evaluate` 调 API？** 因为是在浏览器的 JS 环境里执行，请求头、Cookie、TLS 指纹都跟真实浏览器一模一样，WAF 无法区分。

---

## 九、完整的爬虫模板

```python
import time
from playwright.sync_api import sync_playwright

# ─── 启动浏览器 ──────────────────────
p = sync_playwright().start()
browser = p.chromium.launch(
    headless=True,
    args=['--disable-blink-features=AutomationControlled']
)
context = browser.new_context(
    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...'
)
page = context.new_page()

# 反检测
page.add_init_script('''
    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
    Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
    Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN', 'zh']});
''')

# ─── 访问页面 ──────────────────────
page.goto(url, wait_until='domcontentloaded')
time.sleep(3)

# ─── 提取数据 ──────────────────────
items = page.query_selector_all('.item')
for item in items:
    title = item.query_selector('.title').inner_text()
    # ...

# ─── 翻页 ──────────────────────────
next_btn = page.query_selector('.next-page')
if next_btn:
    next_btn.click()
    time.sleep(3)

# ─── 清理 ──────────────────────────
browser.close()
p.stop()
```

---

## 十、常见坑和解决方法

| 问题 | 原因 | 解决 |
|---|---|---|
| `page.goto` 卡住不动 | `wait_until='networkidle'` 永不超时 | 改成 `domcontentloaded` + `time.sleep()` |
| `Target crashed` | 浏览器内存耗尽 | 减少运行时间，或用 `browser.close()` 重启 |
| 元素找不到 | 页面没加载完 | 加 `page.wait_for_selector('.xxx')` 或 `time.sleep()` |
| 翻页后元素还是旧的 | 页面还没完全更新 | 点击后等待 `time.sleep(2-3)` |
| WAF 仍然拦截 | 缺少反检测脚本 | 加上 `add_init_script` 三件套 |
| 中文乱码 | Windows 控制台问题 | CSV 用 `utf-8-sig`，数据本身没问题 |

---

## 总结

Playwright 就是**最后一层保障**——当 `requests` 搞不定、API 找不到的时候，用真实浏览器强行打开页面拿数据。代价是慢（每页 1-3 秒 vs requests 0.1 秒）、吃内存（跑久了会崩）、需要反检测脚本。

正确的做事顺序永远是：
1. `requests` 试试 → 不行
2. 找 API → 找不到
3. 再上 **Playwright**