---
title: "dict（哈希字典）"
published: 2026-09-15
updated: 2026-09-16
description: ""
tags: ["学习笔记","Python","算法竞赛"]
category: "Python Contest"
draft: false
section: "Python Contest"
sectionSlug: "python-contest"
sectionOrder: 6
sourcePath: "Python Contest/dict（哈希字典）.md"
---
```python
# 初始化
mp = {} 

# 赋值
mp["apple"] = 3 

# 判断键是否存在
if "apple" in mp:
    print(mp["apple"])
    
# 遍历
for key, value in mp.items():
    print(key, value)
    
# 安全获取值 .get(键,默认值) 若键不存在则返回默认值
mp.get("orange", 0)
```

如果只需要存“某个元素是否出现过”，可以用 `set`，它也是基于哈希表实现的：

```python
seen = set()
seen.add("apple")
print("apple" in seen)  # True
```
