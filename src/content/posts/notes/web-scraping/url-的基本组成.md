---
title: "URL 的基本组成"
published: 2026-09-15
updated: 2026-09-15
description: ""
tags: ["学习笔记","爬虫"]
category: "爬虫笔记"
draft: false
section: "爬虫笔记"
sectionSlug: "web-scraping"
sectionOrder: 1
sourcePath: "爬虫学习/URL 的基本组成.md"
---
```
[Scheme]://[Authority][Path to the file][Parameters][Anchor]
[方案]://[权威][资源路径][参数][锚点]
```
1. <font color="#f79646">方案</font>：例如 http、 https
2. <font color="#f79646">权威</font>：
```
[Domain Name]:[Port]
[域]:[端口]
```
	域：域名或IP地址（少见）
	端口：标准端口：http(80),https(443)。只有标准端口可以省略。
	与方案的分隔符其实是 : ，但要加 // 表示下面是权威
3. <font color="#f79646">资源路径</font>：Web 服务器上资源的路径
4. <font color="#f79646">参数</font>：用 & 分隔的键值对（key=value）列表，以 ? 开头
5. <font color="#f79646">锚点</font>：锚点表示资源中的一种“书签”，给浏览器显示位于该“加书签”位置的内容的方向。锚点由 # 开头，# 之后的内容不会被浏览器发给服务器，而是由浏览器自己查找锚点的元素并滚动到那里