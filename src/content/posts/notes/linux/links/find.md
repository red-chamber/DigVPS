---
title: "find"
published: 2026-09-15
updated: 2026-09-15
description: ""
tags: ["学习笔记","Linux"]
category: "Linux"
draft: false
section: "Linux"
sectionSlug: "linux"
sectionOrder: 5
sourcePath: "Linux/links/find.md"
---
`grep` 用来“在文件内容里找文字”，`find` 用来“按文件名、位置、时间等找文件”。

## grep

1. **查找行**，会返回所有含有目标词的整行，并显示行号
```bash
grep -n "hello" file.txt
```
2. **忽略大小写**
```bash
grep -i "hello" file.txt
```
3. **递归搜索当前目录及子目录中的内容**
```bash
grep -r "hello" .
```
4. **显示“不以 `#` 开头”的行**，常用来过滤注释
```bash
grep -v "^#" config.txt
```

## find

1. 在当前目录及子目录中找（最基础版）
```bash
find . -name "file.txt"
# 文件名可换成类似 "*.py" 的通配符
```
2. 指定起点递归搜索，并指定匹配类型 
```bash
find ~/project -type d -name "src"
# find 搜索起点 -type 只匹配目录(directory) -name 要匹配的项目名称
# 除了 d，还有 f（普通文件），l（符号链接）
# ~/project 换成 . 就是当前目录
```
3. 忽略大小写
```bash
find . -type f -iname "*.log"
# 关键参数 -iname
```

## 联合搜索

```bash
find . -name "*.py" -exec grep -nH "to be found" {} +
# -exec 的前面意为从当前目录开始递归查找到的所有后缀 .py 的文件，后面是对每一个找到的文件，找里面的 to be found
# -n 显示行号，-H 显示文件名
```

`-exec ... {} +`：对前面语句的结果执行后面语句的命令
