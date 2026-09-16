---
title: "IO"
published: 2026-09-15
updated: 2026-09-16
description: ""
tags: ["学习笔记","Python","算法竞赛"]
category: "Python Contest"
draft: false
section: "Python Contest"
sectionSlug: "python-contest"
sectionOrder: 6
sourcePath: "Python Contest/IO.md"
---
## 输出

```python
print(a,b,c,sep='-') # 分隔符：a-b-c
print(a,end=' ') # 结束符：输出后不换行，接一个空格
print(f"{a}") # 格式化输出
```

## 输入

快读模板
```python
import sys
input=lambda:sys.stdin.readline().strip()
```

单行多个数据
```python
a,b,c=map(int,input().spilt())
# spilt() 按空格分割，int 强制转换成 int 型
```

多行
```python
n=int(input()) # 强制转换成 int
lst=[int(input()) for _ in range(n)]
# _是占位符

# 矩阵输入
n,m=map(int,input().spilt())
matrix=[list(map(int,input().spilt())) for _ in range(n)]
```
