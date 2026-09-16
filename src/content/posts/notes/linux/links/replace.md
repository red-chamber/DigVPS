---
title: "replace"
published: 2026-09-15
updated: 2026-09-15
description: ""
tags: ["学习笔记","Linux"]
category: "Linux"
draft: false
section: "Linux"
sectionSlug: "linux"
sectionOrder: 5
sourcePath: "Linux/links/replace.md"
---
## 一、`sed`

```bash
sed -i 's/要替换的内容/替换后的内容/g' 文件名
```

- `-i`：直接修改原文件（不加就是只打印到屏幕，不改文件，可以不加作为预览）
- `g`：一行里替换所有匹配（不加 `g` 只替换每行第一个）

**例子：**

```bash
# 把文件里所有 cat 换成 dog
sed -i 's/cat/dog/g' notes.txt

# 用扩展正则（+ ? | () 不用反斜杠），-E 或 -r
sed -i -E 's/[0-9]+/N/g' data.txt

# 捕获组：把 name: 张三  改成  张三 (name)
sed -i -E 's/(name): *(.+)/\2 (\1)/' info.txt

# 当前目录所有 txt
sed -i 's/旧/新/g' *.txt

# 递归当前目录及其子目录和子文件的所有 .md
find . -name '*.md' -exec sed -i 's/旧/新/g' {} +

# 改之前可以先备份
sed -i.bak 's/旧/新/g' file.txt     # 会生成 file.txt.bak
```

## 二、`perl`（支持更强正则）

需要 `\d`、前后查找、非贪婪等高级语法时：

```bash
perl -i -pe 's/\d+/NUM/g' file.txt         # 原地修改
perl -i.bak -pe 's/(\w+)@(\w+)/\1[at]\2/g' file.txt
```

- `-p` 逐行处理、自动打印
- `-e` 后面是表达式
- `-i` 原地改（`-i.bak` 备份）

## 三、vim 本身的替换功能

想边看边改、逐处确认，在 vim 里：

```vim
:%s/正则/替换/gc
```
- `%` 整个文件，`g` 全部，`c` 每处**询问确认**（`y`/`n`）
- 不加 `c` 就是全部直接替换

> sed 的多个替换之间用 ` ; ` 分隔，而 vim 里用管道符 `|`
