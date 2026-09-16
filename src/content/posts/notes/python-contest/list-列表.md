---
title: "list（列表）"
published: 2026-09-15
updated: 2026-09-16
description: ""
tags: ["学习笔记","Python","算法竞赛"]
category: "Python Contest"
draft: false
section: "Python Contest"
sectionSlug: "python-contest"
sectionOrder: 6
sourcePath: "Python Contest/list（列表）.md"
---
## 从某一项的值找它的下标

.index()
```python
nums = [10, 20, 30]
i = nums.index(20)
print(i)  # 1
```
- 若有重复值，只返回第一次出现的下标
- 如果值不存在，会报错

## 二维数组排序

```python
arr.sort(key=lambda x: x[0], reverse=True)
# lambda x:x[0] 表示取第一个元素作为排序依据，reverse=True 表示从大到小
# 这会将数组原地排序
```
