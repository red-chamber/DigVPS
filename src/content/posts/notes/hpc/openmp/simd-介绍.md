---
title: "SIMD 介绍"
published: 2026-09-15
updated: 2026-09-15
description: ""
tags: ["学习笔记","HPC","OpenMP","SIMD"]
category: "HPC"
draft: false
section: "HPC"
sectionSlug: "hpc"
sectionOrder: 4
sourcePath: "HPC/OpenMP/SIMD 介绍.md"
---
SIMD（Single Instruction，Multiple Data）：**一条 CPU 指令同时处理多个数据元素**。

## 1. SIMD 和多线程

多线程：多个 CPU 核心同时工作
SIMD：一个 CPU 核心一次处理多个数据

可以组合使用：
多线程：把大数组切成多个区间
SIMD：每个线程快速处理自己区间中的多个元素

OpenMP 中：
```cpp
#pragma omp parallel for simd
```

就是“多线程 + SIMD”的常见写法。

## 2. 常见 SIMD 指令集

在 x86 CPU 上，常见指令集如下：

| 指令集 | 向量寄存器宽度 | 可同时处理的元素数量 |
|---|---:|---|
| SSE | 128 位 | 4 个 `float` / 2 个 `double` / 4 个 `int32_t` |
| AVX | 256 位 | 8 个 `float` / 4 个 `double` |
| AVX2 | 256 位 | 8 个 `int32_t` / 8 个 `float` / 4 个 `double` |
| AVX-512 | 512 位 | 16 个 `float` / 8 个 `double` / 16 个 `int32_t` |

ARM 平台上常见的是：

```text
NEON：通常 128 位
SVE：向量长度可变
```

## 3. 让编译器自动向量化

先写清晰的普通循环：
```cpp
long long sum_array(const int* arr, int len) {
    long long sum = 0;
    for (int i = 0; i < len; ++i) {
        sum += arr[i];
    }
    return sum;
}
```

然后用优化选项编译：
```bash
g++ -O3 -march=native -Wall demo.cpp -o demo
```

其中：
```text
-O3          开启较强优化
-march=native 根据当前 CPU 启用合适的 SIMD 指令
```

编译器通常能自动把这种简单循环变成 SIMD 指令。

可要求 GCC 输出向量化报告：
```bash
g++ -O3 -march=native \
    -fopt-info-vec-optimized \
    -fopt-info-vec-missed \
    demo.cpp -o demo
```
若看到类似 `loop vectorized` 说明循环已被向量化。

## 4. 使用 OpenMP 的 `simd` 指令

如果编译器没有自动向量化，或者你想明确表达“这个循环可以 SIMD”，可以写：

```cpp
long long sum_array_simd(const int* arr, int len) {
    long long sum = 0;

    #pragma omp simd reduction(+: sum)
    for (int i = 0; i < len; ++i) {
        sum += arr[i];
    }

    return sum;
}
```

`reduction(+: sum)` 很关键，因为 SIMD 不同车道会同时算局部和：
```text
车道 0：arr[0] + arr[4] + ...
车道 1：arr[1] + arr[5] + ...
车道 2：arr[2] + arr[6] + ...
车道 3：arr[3] + arr[7] + ...
```
最后必须把所有局部和合并为最终的 `sum`。

多线程和 SIMD 一起使用：
```cpp
long long dot_product_parallel_simd(
    const int* a, const int* b, int len
) {
    long long sum = 0;

    #pragma omp parallel for simd reduction(+: sum) schedule(static)
    for (int i = 0; i < len; ++i) {
        sum += static_cast<long long>(a[i]) * b[i];
    }

    return sum;
}
```

编译：
```bash
g++ -O3 -march=native -fopenmp demo.cpp -o demo
```

## 5. SIMD 能安全使用的前提

SIMD 最适合“每次循环彼此独立”的场景，不适合循环携带依赖（loop-carried dependency）。

另一个常见问题是指针别名：
```cpp
void add(int* a, int* b, int* c, int n) {
    for (int i = 0; i < n; ++i) {
        c[i] = a[i] + b[i];
    }
}
```

编译器无法确定 c 是否与 a 或 b 指向同一块内存，在 C 中可用 `restrict` 表示它们不会重叠：
```c
void add(
    const int* restrict a,
    const int* restrict b,
    int* restrict c,
    int n
) {
    for (int i = 0; i < n; ++i) {
        c[i] = a[i] + b[i];
    }
}
```

C++ 没有标准 `restrict`，GCC/Clang 可使用非标准的：
```cpp
const int* __restrict a
```

## 6. 直接使用 AVX 内联函数

若需要精确控制 SIMD 指令，可使用 intrinsic（内联函数）。它们通常位于：
```cpp
#include <immintrin.h>
```

下面是 AVX 版本的 `float` 点积示例：

```cpp
#include <immintrin.h>
#include <cstddef>

float dot_product_avx(
    const float* a,
    const float* b,
    std::size_t len
) {
    __m256 vector_sum = _mm256_setzero_ps();

    std::size_t i = 0;

    /* 每次处理 8 个 float */
    for (; i + 8 <= len; i += 8) {
        __m256 va = _mm256_loadu_ps(a + i);
        __m256 vb = _mm256_loadu_ps(b + i);

        __m256 product = _mm256_mul_ps(va, vb);
        vector_sum = _mm256_add_ps(vector_sum, product);
    }

    /* 把 8 个 SIMD 车道的结果合并 */
    alignas(32) float lanes[8];
    _mm256_store_ps(lanes, vector_sum);

    float sum = 0.0f;

    for (int lane = 0; lane < 8; ++lane) {
        sum += lanes[lane];
    }

    /* 处理剩余不足 8 个的元素 */
    for (; i < len; ++i) {
        sum += a[i] * b[i];
    }

    return sum;
}
```

编译：
```bash
g++ -O3 -mavx demo.cpp -o demo
```

若使用 FMA 指令：
```cpp
vector_sum = _mm256_fmadd_ps(va, vb, vector_sum);
```
则需要：
```bash
g++ -O3 -mavx2 -mfma demo.cpp -o demo
```

这里几个常见 intrinsic 的意义是：

| intrinsic | 含义 |
|---|---|
| `_mm256_setzero_ps()` | 创建 8 个 `float` 都为 0 的向量 |
| `_mm256_loadu_ps()` | 从内存读取 8 个 `float`；不要求 32 字节对齐 |
| `_mm256_load_ps()` | 读取 8 个 `float`；要求地址按 32 字节对齐 |
| `_mm256_add_ps()` | 8 个 `float` 分别相加 |
| `_mm256_mul_ps()` | 8 个 `float` 分别相乘 |
| `_mm256_store_ps()` | 将向量写回内存 |
| `_mm256_fmadd_ps()` | 执行 `a * b + c`，通常更高效且精度更好 |

## 7. 对齐与尾部处理

SIMD 指令通常偏好对齐的数据。例如 AVX 的 256 位向量是 32 字节 = 8 个 float = 4 个 double，但普通数组起始地址不一定恰好按 32 字节对齐。因此常见策略是使用不要求对齐的读取：
```cpp
_mm256_loadu_ps(...)
```
其中 `u` 是 unaligned 的意思。

## 8. 整数溢出与浮点误差

SIMD 并不自动解决数值问题。原始题目若使用：
```cpp
int sum;
```
数组很大时可能溢出。更稳妥的写法是：
```cpp
long long sum = 0;
```
点积尤其应先扩大类型：
```cpp
sum += static_cast<long long>(a[i]) * b[i];
```

浮点加法不严格满足结合律，所以 SIMD 或多线程归约的结果可能和串行结果最后几位略有不同。这通常是正常的舍入误差。

## 9. 为什么 SIMD 或多线程不一定加速

数组求和、点积通常是内存带宽型任务，读取大量数组数据，但每个元素只做一次或少量计算。CPU 很快读完缓存后，主要在等内存。此时即使增加更多 SIMD 车道或线程，也可能受内存带宽限制。

此外，多线程还需要 分配工作→ 每线程计算局部结果→ reduction 合并→ 同步

- 短循环：多线程往往更慢
- 内存带宽已饱和：更多线程收益很小
- 计算密集型任务：SIMD + 多线程通常更有效

## 10. 实战建议

1. 先写正确、连续访问内存的普通循环
2. 使用 -O3，并检查编译器是否自动向量化
3. 必要时添加 `#pragma omp simd`
4. 需要多核时再添加 `parallel for`
5. 只在性能瓶颈明确时手写 `AVX/AVX-512 intrinsic`

最实用的 OpenMP 模板是：
```cpp
long long sum = 0;

#pragma omp parallel for simd reduction(+: sum) schedule(static)
for (int i = 0; i < len; ++i) {
    sum += static_cast<long long>(a[i]) * b[i];
}
```
