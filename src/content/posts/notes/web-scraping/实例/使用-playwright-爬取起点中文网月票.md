---
title: "使用 Playwright 爬取起点中文网月票"
published: 2026-09-15
updated: 2026-09-15
description: ""
tags: ["学习笔记","爬虫","Playwright"]
category: "爬虫笔记"
draft: false
section: "爬虫笔记"
sectionSlug: "web-scraping"
sectionOrder: 1
sourcePath: "爬虫学习/实例/使用 Playwright 爬取起点中文网月票.md"
---
```python
import csv
import time
from playwright.sync_api import sync_playwright

CSV_FILE = 'qidian_yuepiao.csv'

"""启动浏览器并通过反爬验证"""
def start_browser():
    p = sync_playwright().start()
    browser = p.chromium.launch(
        headless=False,
        args=['--disable-blink-features=AutomationControlled']
    )
    ctx = browser.new_context(
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0'
    )
    page = ctx.new_page()
    # 反检测脚本
    page.add_init_script('''
        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
        Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN', 'zh']});
    ''')
    page.goto('https://www.qidian.com/rank/yuepiao/', wait_until='domcontentloaded', timeout=15000)
    time.sleep(3)
    print('浏览器启动完成，已通过验证')
    return p, browser, page

"""提取当前页所有书籍信息"""
def scrape_page(page):
    books = []

    items = page.query_selector_all('.book-img-text li')
    for item in items:
        name_el = item.query_selector('.book-mid-info h2 a')
        name = name_el.get_attribute('title') if name_el else ''

        author_el = item.query_selector('.author .name')
        author = author_el.inner_text() if author_el else ''

        type_el = item.query_selector('.author a.go-sub-type')
        book_type = type_el.inner_text() if type_el else ''

        status_el = item.query_selector('.author span')
        status = status_el.inner_text() if status_el else ''

        intro_el = item.query_selector('.intro')
        intro = intro_el.inner_text().strip() if intro_el else ''

        update_el = item.query_selector('.update a')
        update = update_el.inner_text().strip() if update_el else ''

        books.append([name, author, book_type, status, intro, update])

    return books

def main():
    # 先写表头
    with open(CSV_FILE, 'w', newline='', encoding='utf-8-sig') as f:
        csv.writer(f).writerow(['书名', '作者', '分类', '状态', '简介', '最新章节'])

    p, browser, page = start_browser()
    try:
        all_count = 0
        page_num = 1

        while True:
            print(f'正在抓取第 {page_num} 页...')
            books = scrape_page(page)
            all_count += len(books)

            # 每页实时追加写入
            with open(CSV_FILE, 'a', newline='', encoding='utf-8-sig') as f:
                csv.writer(f).writerows(books)
            print(f'  本页 {len(books)} 本书，累计 {all_count} 本')

            next_btn = page.query_selector('a.lbf-pagination-next')
            if not next_btn or 'disabled' in (next_btn.get_attribute('class') or ''):
                break

            next_btn.click()
            time.sleep(3)
            page_num += 1

        print(f'完成！共 {all_count} 本书，已保存到 {CSV_FILE}')

    finally:
        try:
            browser.close()
        except:
            pass
        try:
            p.stop()
        except:
            pass

if __name__ == '__main__':
    main()

```