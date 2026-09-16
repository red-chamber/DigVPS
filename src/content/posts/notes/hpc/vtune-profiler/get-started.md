---
title: "Get Started"
published: 2026-09-15
updated: 2026-09-15
description: ""
tags: ["学习笔记","HPC","VTune"]
category: "HPC"
draft: false
section: "HPC"
sectionSlug: "hpc"
sectionOrder: 4
sourcePath: "HPC/VTune Profiler/Get Started.md"
---
## 1. VTune Profiler Overview

VTune 是 Intel 的性能分析器（profiler）。它不会直接帮你优化代码，而是通过采样和追踪数据，回答这些问题：
- 程序时间究竟耗在哪里？
- 慢是因为算法、串行部分、线程同步、CPU 计算、内存访问，还是 GPU 执行？
- CPU/GPU 是否被充分利用？
- 下一步最值得做哪一种深入分析？

它可从 Windows/Linux 主机分析程序，也能分析远程目标系统。

## 2. Workflow

```text
启动 VTune
  → 建立项目 / 指定程序
  → 选择分析类型并配置
  → 采集运行数据
  → 阅读结果、定位瓶颈
  → 修改代码并再次采集验证
```

- **Project**：保存“要分析的程序、分析配置、采集结果”的容器。
- **Host**：运行 VTune 图形界面和查看结果的机器。
- **Target**：真正被测程序运行的机器；可以就是本机。
- **Collection**：让应用运行，并同时记录性能数据。
- **Result**：一次采集对应的一份数据，通常是 `.vtune` 结果文件。

## 3. Performance Snapshot

**Performance Snapshot（性能快照）**，它不是最细粒度的分析，而是一次“性能体检”：
1. 概览程序性能表现；
2. 标出异常或可疑指标；
3. 给出建议：接下来适合运行哪种专项分析。

基本操作：
1. 打开 VTune GUI，新建项目。
2. 在 **Launch Application** 中选择可执行文件。
3. 保持默认的 Performance Snapshot。
4. 点击 **Start**。
5. 采集结束后，在 **Summary** 页面阅读结果。

Snapshot 主要的功能是判断大方向，不要一开始就盲目跑最复杂的微架构或热点分析；先确定问题是 CPU、内存、并行，还是 GPU 侧，效率更高。

## 4. 常见命令

[常见命令](/posts/notes/hpc/vtune-profiler/links/常见命令/) 