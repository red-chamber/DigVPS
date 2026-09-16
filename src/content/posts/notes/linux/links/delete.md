---
title: "delete"
published: 2026-09-15
updated: 2026-09-15
description: ""
tags: ["学习笔记","Linux"]
category: "Linux"
draft: false
section: "Linux"
sectionSlug: "linux"
sectionOrder: 5
sourcePath: "Linux/links/delete.md"
---
### 1. `rm`：删除文件或目录

```bash
rm [参数] 文件或目录
```

| 参数 | 作用 |
|---|---|
| `-i` | 删除前逐个确认 |
| `-I` | 删除多个文件或递归删除前确认一次 |
| `-f` | 强制删除，不提示；不存在也不报错 |
| `-r` / `-R` | 递归删除目录及其内容 |
| `-d` | 删除空目录（部分系统支持） |
| `-v` | 显示删除过程 |
| `--` | 结束参数解析，用于文件名以 `-` 开头的情况 |

`rm -rf` 风险很高：

```bash
rm -rf directory
```

其中 `-r` 表示递归，`-f` 表示强制

### 2. `rmdir`：删除空目录

```bash
rmdir [参数] 目录
```

| 参数 | 作用 |
|---|---|
| `-p` | 删除目录，并继续删除变空的父目录 |
| `-v` | 显示处理过程 |
| `--ignore-fail-on-non-empty` | 目录非空时不报告失败 |

如果目录不是空的，`rmdir` 默认不会删除，因此比 `rm -r` 安全。

### 3. `unlink`：删除单个文件

```bash
unlink 文件
```

它通常一次只处理一个文件，不能递归删除目录。

### 4. `find -delete`：按条件批量删除

```bash
find 路径 条件 -delete

find ./logs -type f -name '*.log' -delete
find ./cache -type f -mtime +30 -delete
find ./temp -type d -empty -delete
```

把 `-delete` 换成 `-print` 检查匹配结果：

```bash
find ./logs -type f -name '*.log' -print
```

注意：`-delete` 会隐式启用深度优先遍历，条件顺序也会影响结果。