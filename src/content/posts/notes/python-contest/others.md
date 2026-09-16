---
title: "others"
published: 2026-09-15
updated: 2026-09-16
description: ""
tags: ["学习笔记","Python","算法竞赛"]
category: "Python Contest"
draft: false
section: "Python Contest"
sectionSlug: "python-contest"
sectionOrder: 6
sourcePath: "Python Contest/others.md"
---
## lambda 表达式

即匿名函数

```python
# lambda 参数:表达式
x=lambda a:a+10 # 让 x 这个函数实现加 10 的效果
```

## sorted()

```python
# 返回一个排序后的列表，而不是就地排序
sorted(需要排序的可迭代对象,key=排序规则（一般是一个函数）,reverse=是否需要反向排序（默认升序）)

# 原地排序
nums.sort()
```

## 队列

用双端队列模拟
```python
from collections import deque
q=deque()
q.append(x) # 右侧入队
# q.appendleft(x) 左侧入队，但一般不用
x=q.popleft() # 左侧出队
```

## 栈

用列表模拟
```python
stk=[]
stk.append(x) # 入栈
x=stk.pop() # 出栈
stk[-1] # 即得到列表的最后一个元素（栈顶）
```

```python
# 判断空队列/栈
if not q: # q 是空的

# 栈的翻转
stack[::-1]

# deque 转换为普通列表
list(q)

# 初始化
deque([1,2,3])
```

## 字符和 ASCII 码

```python
# 字符转int
ord('a')
# int转字符
chr(97)
```
