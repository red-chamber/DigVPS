---
title: "C++STL"
published: 2026-09-15
updated: 2026-09-16
description: ""
tags: ["学习笔记","C++","算法竞赛"]
category: "C++ Contest"
draft: false
section: "C++ Contest"
sectionSlug: "cpp-contest"
sectionOrder: 3
sourcePath: "C++ Contest/C++STL.md"
---
## vector 数组

| 代码                              | 算法复杂度  | 返回值类型 | 含义                                                                   |
| ------------------------------- | ------ | ----- | -------------------------------------------------------------------- |
| `c.front()`                     | $O(1)$ | 引用    | 返回容器中的第一个数据                                                          |
| `c.back()`                      | $O(1)$ | 引用    | 返回容器中的最后一个数据                                                         |
| `c.size()`                      | $O(1)$ |       | 返回实际数据个数（unsigned 类型）                                                 |
| `c.begin()`                     | $O(1)$ | 迭代器   | 返回首元素的迭代器（通俗来说就是地址）                                                  |
| `c.end()`                       | $O(1)$ | 迭代器   | 返回最后一个元素后一个位置的迭代器（地址）                                                |
| `c.empty()`                     | $O(1)$ | bool  | 判断是否为空，为空返回真，反之返回假                                                   |
| `c.reserve(sz)`                 |        |       | 为数组提前分配 `sz` 的内存大小，即改变了 `capacity` 的大小，主要是为了防止在 `push_back` 过程中多次的内存拷贝 |
| `c.emplace_back(ele)`           | $O(1)$ |       | 在数组中加入一个数据，和 `push_back` 功能基本一样，在某些情况下比它效率更高，支持传入多个构造参数              |
| `c.resize(n, v)`                |        |       | 改变数组大小为 `n`，`n` 个空间数值赋为 `v`，如果没有默认赋值为 `0`                                |
| `c.insert(pos, x)`              | $O(N)$ |       | 向任意迭代器 `pos` 插入一个元素 `x`                                                 |
| `c.erase(first, last)`          | $O(N)$ |       | 删除 `[first, last)` 的所有元素                                               |

## stack 栈

| 代码 | 含义 | 算法复杂度 |
|------|------|------------|
| `s.push(ele)` | 元素 `ele` 入栈，增加元素 | $O(1)$ |
| `s.pop()` | 移除栈顶元素 | $O(1)$ |
| `s.top()` | 取得栈顶元素（但不删除） | $O(1)$ |
| `s.empty()` | 检测栈内是否为空，空为真 | $O(1)$ |
| `s.size()` | 返回栈内元素的个数 | $O(1)$ |

## queue 队列

| 代码 | 含义 | 算法复杂度 |
|------|------|------------|
| `q.front()` | 返回队首元素 | $O(1)$ |
| `q.back()` | 返回队尾元素 | $O(1)$ |
| `q.push(element)` | 尾部添加一个元素 `element` 进队 | $O(1)$ |
| `q.pop()` | 删除第一个元素 出队 | $O(1)$ |
| `q.size()` | 返回队列中元素个数，返回值类型 `unsigned int` | $O(1)$ |
| `q.empty()` | 判断是否为空，队列为空，返回 `true` | $O(1)$ |

## map

| 代码                     | 含义                                                                                  | 复杂度           |
| ---------------------- | ----------------------------------------------------------------------------------- | ------------- |
| `mp.find(key)`         | 返回键为 key 的映射的迭代器 注意：用 find 函数来定位数据出现位置，它返回一个迭代器。当数据存在时，返回数据所在位置的迭代器，数据不存在时，返回 `mp.end()` | $O(logN)$       |
| `mp.erase(it)`         | 删除迭代器对应的键和值                                                                         | $O(logN)$       |
| `mp.erase(key)`        | 根据映射的键删除键和值                                                                         | $O(logN)$       |
| `mp.erase(first,last)` | 删除左闭右开区间迭代器对应的键和值                                                                   | O（last-first） |
| `mp.size()`            | 返回映射的对数                                                                             | $O(1)$        |
| `mp.insert()`          | 插入元素，插入时要构造键值对                                                                      | $O(N)$        |
| `mp.empty()`           | 如果 map 为空，返回 true，否则返回 false                                                            | $O(1)$        |
| `mp.begin()`           | 返回指向 map 第一个元素的迭代器（地址）                                                                | $O(1)$        |
| `mp.end()`             | 返回指向 map 尾部的迭代器（最后一个元素的**下一个**地址）                                                     | $O(1)$        |
| `mp.count(key)`        | 查看元素是否存在，因为 map 中键是唯一的，所以存在返回 1，不存在返回 0                                                 | $O(logN)$       |
| `mp.lower_bound()`     | 返回一个迭代器，指向键值>= **key** 的第一个元素                                                        |               |

- map：内部用红黑树实现，具有自动排序（按键从小到大）功能。
- unordered_map：内部用哈希表实现，内部元素无序杂乱。

## set

| 代码                     | 复杂度     | 含义                                            |
| ---------------------- | ------- | --------------------------------------------- |
| `s.begin()`            | $O(1)$    | 返回 set 容器的第一个元素的地址（迭代器）                         |
| `s.end()`              | $O(1)$    | 返回 set 容器的最后一个元素的下一个地址（迭代器）                     |
| `s.clear()`            | $O(N)$    | 删除 set 容器中的所有的元素，无返回值                           |
| `s.empty()`            | $O(1)$    | 判断 set 容器是否为空                                   |
| `s.insert(element)`    | $O(logN)$ | 插入一个元素                                        |
| `s.size()`             | $O(1)$    | 返回当前 set 容器中的元素个数                               |
| `erase(iterator)`      | $O(logN)$ | 删除定位器 iterator 指向的值                             |
| `erase(first, second）` |         | 删除定位器 first 和 second 之间的值                         |
| `erase(key_value)`     | $O(logN)$ | 删除键值 key_value 的值                               |
| `s.find(element)`      |         | 查找 set 中的某一元素，有则返回该元素对应的迭代器，无则返回结束迭代器           |
| `s.count(element)`     |         | 查找 set 中的元素出现的个数，由于 set 中元素唯一，此函数相当于查询 element 是否出现 |
| `s.lower_bound(k)`     | $O(logN)$ | 返回大于等于 k 的第一个元素的迭代器                             |

## string

- 获取字符串长度

| 代码                      | 含义                                     |
| ----------------------- | -------------------------------------- |
| `s.size()` 和 `s.length()` | 返回 string 对象的字符个数，他们执行效果相同。|
| `s.max_size()`          | 返回 string 对象最多包含的字符数，超出会抛出 length_error 异常 |

- 插入

| 代码                          | 含义                |
| --------------------------- | ----------------- |
| `s.push_back()`             | 在末尾插入             |
| `s.insert(pos,element)`     | 在 pos 位置插入 element   |
| 例：`s.insert(s.begin(),'1')` | 在第一个位置插入 1 字符       |
| `s.append(str)`             | 在 s 字符串结尾添加 str 字符串   |

- 删除

| 代码 | 含义 |
|------|------|
| `erase(iterator p)` | 删除字符串中 p 所指的字符 |
| `erase(iterator first, iterator last)` | 删除字符串中迭代器区间 `[first,last)` 上所有字符 |
| `erase(pos, len)` | 删除字符串中从索引位置 pos 开始的 len 个字符 |
| `clear()` | 删除字符串中所有字符 |

- 字符替换

| 代码                       | 含义                                         |
| ------------------------ | ------------------------------------------ |
| `s.replace(pos,n,str)`   | 把当前字符串从索引 pos 开始的 n 个字符替换为 str                  |
| `s.replace(pos,n,n1,c)`  | 把当前字符串从索引 pos 开始的 n 个字符替换为 n1 个字符 c               |
| `s.replace(it1,it2,str)` | 把当前字符串 `[it1,it2)` 区间替换为 str    it1，it2 为迭代器哦 |

- 分割

| 代码 | 含义 |
|------|------|
| `s.substr(pos,n)` | 截取从 `pos` 索引开始的 `n` 个字符 |

- 查找

| 代码                          | 含义                                                          |
| --------------------------- | ----------------------------------------------------------- |
| `s.find(str, pos)`          | 在当前字符串的 `pos` 索引位置（默认为 0）开始，查找子串 `str`，返回找到的位置索引，`-1` 表示查找不到子串  |
| `s.find(c, pos)`            | 在当前字符串的 `pos` 索引位置（默认为 0）开始，查找字符 `c`，返回找到的位置索引，`-1` 表示查找不到字符    |
| `s.find_first_of(str, pos)` | 在当前字符串的 `pos` 索引位置（默认为 0）开始，查找子串 `s` 的字符，返回找到的位置索引，`-1` 表示查找不到字符 |
| `s.find_last_of(str, pos)`  | 在当前字符串的 `pos` 索引位置开始，查找最后一个位于子串 `s` 的字符，返回找到的位置索引，`-1` 表示查找不到字符  |

## lower_bound 二分查找

- 时间复杂度 $O(\log  n)$
```cpp
//在 a 数组中查找第一个大于等于 x 的元素，返回该元素的地址，如果未找到，返回尾地址的下一个位置的地址
lower_bound(a,a+n,x);
```

## reverse 反转数组

- 时间复杂度 $O(N)$
```cpp
reverse(beg,end);
```

## sort 排序

- 对数组正常升序排序
```cpp
int a[N]; // 普通数组定义
// 对 a 数组的[1, n]位置进行从小到大排序
sort(a + 1, a + 1 + n);

vector<int> b(n + 1); // vector数组定义
sort(b.begin() + 1, b.end());
```

- 使用第三个参数，进行降序排序
```cpp
//对a数组的[0, n-1]位置从大到小排序
sort(a, a + n, greater<int>());
//对a数组的[0, n-1]位置从小到大排序
sort(a, a + n, less<int>());

vector<int> b(n + 1);
sort(b.begin() + 1, b.end()); // 升序
sort(b.begin() + 1, b.end(), greater<int>()); // 降序
```

## stoi 字符串转数字

- 将对应 string 类型字符串转换为数字（`int` 型）
```cpp
stoi(const string*);
```

## \_\_gcd

- 求 a 和 b 的最大公约数
```cpp
__gcd(a, b);
```

## priority_queue 大根堆

```cpp
priority_queue<int> pq;

// 插入
pq.push(5);              // O(log n)

// 访问堆顶
pq.top();                // 返回最大元素（const 引用）

// 删除堆顶
pq.pop();                // 移除最大元素，O(log n)

// 大小和判空
pq.size();
pq.empty();

// 清空（没有 clear，需要重新赋值）
pq = priority_queue<int>();
// 或
pq = {};
```
