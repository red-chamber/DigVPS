---
title: "5.5 parallel for指令"
published: 2026-09-15
updated: 2026-09-15
description: ""
tags: ["学习笔记","HPC","OpenMP"]
category: "HPC"
draft: false
section: "HPC"
sectionSlug: "hpc"
sectionOrder: 4
sourcePath: "HPC/OpenMP/并行程序设计导论笔记/5.用OpenMP进行共享内存编程/5.5 parallel for指令.md"
---
串行版本：
```c
h = (b - a) / n;

approx = (f(a) + f(b)) / 2.0;

for (i = 1; i <= n - 1; i++) {
    approx += f(a + i * h);
}

approx = h * approx;
```

想让它变成并行只需要：
```c
#pragma omp parallel for num_threads(thread_count) \
    reduction(+: approx)
for (i = 1; i <= n - 1; i++) {
    approx += f(a + i * h);
}
```

`#pragma omp parallel for` 会创建多个线程，并把循环次数分配给这些线程，让每个线程算一部分，达成并行的效果。

使用 `parallel for` 适合于每次循环相互独立，没有依赖的情况

### 警告

1。OpenMP 只会并行化 for 循环，它不会并行化 whi1e 或 do-while 循环。且只能并行化那些可以在如下情况下确定迭代次数的 for 循环：
- 由 for 语句本身确定（就是写出来了）
- 在循环之前确定（例如无限循环）
	若循环内存在 break 等，则不能并行化

2。OpenMP 编译器不检查被 parallel for 指令并行化的循环所包含的迭代间的依赖关系，而是由程序员来识别这些依赖关系。
3。一个或更多个迭代结果依赖于其他迭代的循环，一般不能被 OpenMP 正确地并行化。

以上称为**数据依赖**或**循环依赖**

## private

让每一个线程的指定变量不共享：
```c
#pragma omp parallel for reduction(+: sum) private(factor)
for (int k = 0; k < n; k++) {
    factor = (k % 2 == 0) ? 1.0 : -1.0;
    sum += factor / (2.0 * k + 1.0);
}
```
这样每个线程都有独立的 factor

使用 private 私有化的变量在并行代码块开始时是不确定的，但它不会覆盖在 `#pragma omp` 之前就定义过的同名变量的值。例如：
```c
int x = 5;

#pragma omp parallel private(x)
{
    int my_rank = omp_get_thread_num();
    x = 2 * my_rank + 2; 
    printf("Thread %d: x = %d\n", my_rank, x);
}

printf(x);
```
这里第一个 x 是 5，第二个由代码块自身的赋值决定，最后一个仍然是 5。但如果并行代码块内没有给 x 赋值，那么并行代码块内的 x 是垃圾值。

## 最好不要让 OpenMP 自己决定变量的作用域

使用 `default(none)` 可以强制让程序员明确自己定义每个变量的作用域，例如：
```c
double sum = 0.0;

#pragma omp parallel for num_threads(thread_count) \
    default(none) reduction(+: sum) private(factor) shared(n)
for (int k = 0; k < n; k++) {
    double factor = (k % 2 == 0) ? 1.0 : -1.0;
    sum += factor / (2.0 * k + 1.0);
}
```
此时如果不人为指定，则编译器会报错。

这是一个良好的编程习惯。
