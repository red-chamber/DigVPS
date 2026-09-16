---
title: "str（字符串）"
published: 2026-09-15
updated: 2026-09-16
description: ""
tags: ["学习笔记","Python","算法竞赛"]
category: "Python Contest"
draft: false
section: "Python Contest"
sectionSlug: "python-contest"
sectionOrder: 6
sourcePath: "Python Contest/str（字符串）.md"
---
## 判断某个字符是否在串中

1. in
```python
if 'a' in s:
    # a 在字符串 s 中
if 'a' not in s:
    # a 不在字符串 s 中
```

2. find
```python
s.find('e')  # 返回位置 1
s.find('x')  # 返回 -1
```

## 遍历，同时获取下标和字符

```python
for i, ch in enumerate(s):
    print(i, ch)
```

## 常用函数

- 替换：
```python
s.replace("World", "Python")  # 'Hello Python'
```

- 分割、拼接：
```python
s.split()              # ['Hello', 'World']
s.split("o")           # ['Hell', ' W', 'rld']
"-".join(["a", "b"])   # 'a-b'
```

- 删除两端空白或指定字符：
```python
"  hello \n".strip()  # 'hello'
"---hello---".strip("-")  # 'hello'

"  hello".lstrip()    # 'hello'
"hello  ".rstrip()    # 'hello'
```

- 判断字符串类型：
```python
"123".isdigit()       # True：全是数字
"abc".isalpha()       # True：全是字母
"abc123".isalnum()    # True：全是字母或数字
```

- 前缀、后缀判断：
```python
s.startswith("Hello")  # True
s.endswith("World")    # True
```

- 字符与 ASCII / Unicode 编码转换：
```python
ord('a')  # 97
chr(97)   # 'a'
```

注意：字符串不可直接修改。
```python
s[0] = 'h'  # 会报错
```
要“修改”字符串，需要生成新字符串：
```python
s = "h" + s[1:]  # 'hello World'
```
