---
title: "OpenMP基本概念"
published: 2026-09-15
updated: 2026-09-15
description: ""
tags: ["学习笔记","HPC","OpenMP"]
category: "HPC"
draft: false
section: "HPC"
sectionSlug: "hpc"
sectionOrder: 4
sourcePath: "HPC/OpenMP/OpenMP基本概念.md"
---
OpenMP：Open Multi-Processing：支持跨平台共享内存方式的多线程编程接口（规范）

OpenMP 概述
- 面向多线程并行编码的编译指导语句
- 包括相应的函数接口库和 runtime（运行时系统）
- 极大的简化多线程编码，支持 Fortran，C and C++
- 从 SMP （Shared memory machines）实现开始，已经发布和发展了 25 年

通过在需要并行执行的代码段添加 OpenMP 规范的编译指导语句来实现从主线程派生和销毁多个线程，并通过 runtime 系统或者 OpenMP 函数库的标准接口来控制线程的数量、调度、同步、互斥等。

并行区开头，添加相应的编译指导语句，开启多线程，主线程产生派生线程，并行区结束部分，使用相应的编译指导语句销毁多线程。
