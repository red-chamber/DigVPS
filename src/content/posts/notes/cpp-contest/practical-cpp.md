---
title: "Practical cpp"
published: 2026-09-15
updated: 2026-09-16
description: ""
tags: ["学习笔记","C++","算法竞赛"]
category: "C++ Contest"
draft: false
section: "C++ Contest"
sectionSlug: "cpp-contest"
sectionOrder: 3
sourcePath: "C++ Contest/Practical cpp.md"
---
## 基础模板

```cpp
#include <bits/stdc++.h>  
using namespace std;  
#define ll long long  
  
int main() {  
    ios::sync_with_stdio(false);  
    cin.tie(0);  
    return 0;  
}
```

## 数字快速幂

```cpp
long long fast_pow(long long base, long long exponent) {
    long long result = 1;
    // base %= mod;
    while (exponent > 0) { 
        if (exponent & 1) { 
            result *= base;//result = (result * base) % mod;
        }
        base *= base;//base = (base * base) % mod;   
        exponent >>= 1;    
    }
    return result;
}
```

## 埃氏素数筛法

>（假设要筛出 $2e6$ 以内的素数）

```cpp
int flag[2000010];
void init() {
//埃氏筛初始化 
for (int a=2;a<=2000000;a++) { 
	if (flag[a]) continue; 
	for (int b=a+a;b<=2000000;b+=a) flag[b]=1; 
	} 
}
```

## 二分查找（手动）

>找数组中第一个大于等于 $x$ 的元素及其下标

```cpp
pair<int, int> findFirstGE(const int a[], int n, int x) {  
    int left = 0;  
    int right = n - 1;  
    int res_idx = -1; // 初始化为-1，表示未找到  
    int res_val = -1;  
    while (left <= right) {  
        // 计算mid，避免left+right溢出（等价于(left+right)/2，但更安全）  
        int mid = left + (right - left) / 2;  
        if (a[mid] >= x) {  
            res_idx = mid;  
            res_val = a[mid];  
            right = mid - 1;  
        } else left = mid + 1;  
    }  
    return {res_idx, res_val};  
}
```

## 计算两组区间的交集和并集

```cpp
// 计算两个区间的交集，返回空区间（l > r）表示无交集  
pair<ll, ll> get_intersection(ll l1, ll r1, ll l2, ll r2) {  
    ll inter_l = max(l1, l2);  
    ll inter_r = min(r1, r2);  
    return {inter_l, inter_r}; }  
  
// 计算一组区间的并集总长度  
ll calculate_union_length(vector<pair<ll, ll>>& intervals) {  
    if (intervals.empty()) return 0;  
    sort(intervals.begin(), intervals.end());  
    ll total = 0;  
    ll cur_l = intervals[0].first;  
    ll cur_r = intervals[0].second;  
    for (size_t i = 1; i < intervals.size(); ++i) {  
        ll l = intervals[i].first;  
        ll r = intervals[i].second;  
        if (l <= cur_r) {             cur_r = max(cur_r, r);  
        } else {             total += cur_r - cur_l;  
            cur_l = l;  
            cur_r = r;  
        }  
    }  
    total += cur_r - cur_l;  
    return total;  
}  
```

## 读行，按空格分字符串

```cpp
string line;  
while (getline(cin, line)){ }

vector<string> split(const string &s){  
    vector<string> res;  
    stringstream ss(s);  
    string temp;  
    while(ss>>temp){  
        res.push_back(temp);  
    }  
    return res;  
}
```

# BFS 广度优先搜索模板

```cpp
void bfs(int u) {
  queue<int> Q;
  while (!Q.empty()) Q.pop();
  Q.push(u);
  vis[u] = 1;
  d[u] = 0;
  p[u] = -1;
  while (!Q.empty()) {
    u = Q.front();
    Q.pop();
    for (int i = head[u]; i; i = e[i].nxt) {
      if (!vis[e[i].to]) {
        Q.push(e[i].to);
        vis[e[i].to] = 1;
        d[e[i].to] = d[u] + 1;
        p[e[i].to] = u;
      }
    }
  }
}

void restore(int x) {
  vector<int> res;
  for (int v = x; v != -1; v = p[v]) {
    res.push_back(v);
  }
  std::reverse(res.begin(), res.end());
  for (int i = 0; i < res.size(); ++i) printf("%d", res[i]);
  puts("");
}
```

## DFS 深度优先搜索

```cpp
vector<vector<int>> adj;  // 邻接表
vector<bool> vis;         // 记录节点是否已经遍历

void dfs(int s) {
  stack<int> st;
  st.push(s);
  vis[s] = true;

  while (!st.empty()) {
    int u = st.top();
    st.pop();

    for (int v : adj[u]) {
      if (!vis[v]) {
        vis[v] = true;  // 确保栈里没有重复元素
        st.push(v);
      }
    }
  }
}
```

# pair 对 int 的哈希函数

低版本适配：
```cpp
struct PairHash {
		size_t operator()(const std::pair<int, int>& p) const {
			size_t h1 = std::hash<int>()(p.first);
			size_t h2 = std::hash<int>()(p.second);
			return h1 ^ (h2 << 1);
		}
	};
std::unordered_map<std::pair<int, int>, bool, PairHash> istrash;
```

# 自定义结构体数组按成员排序

```cpp 
sort(arr, arr + n, [](const Student& a, const Student& b) { 
		return a.score < b.score; // 从小到大：a.成员 < b.成员 
});
```

# 分解质因数 

> 结果数组不递减地存储了 $n$ 的所有最小质因数。时间复杂度 $O(\sqrt{ n })$。

```cpp
vector<ll> factor(ll n) {  
    vector<ll> res;  
    for (ll i = 2; i * i <= n; i++) {  
        while (n % i == 0) {  
            res.push_back(i);  
            n /= i;  
        }  
    }  
    if (n > 1) res.push_back(n);  
    return res;  
}  
```

## Dijkstra 求一个点到其余所有点的最短距离（有权图）

```cpp
#include <bits/stdc++.h>
using namespace std;
using ll = long long;
using pii = pair<int, int>;

const int N = 100005;
const ll INF = 0x3f3f3f3f3f3f3f3fLL;

vector<pii> g[N];   // g[u] = {(v, w), ...}
ll dis[N];// 每个点到源点的最短距离
bool vis[N];
int n, m, s;

void dijkstra(int s) {
    memset(dis, 0x3f, sizeof(dis));
    priority_queue<pii, vector<pii>, greater<pii>> pq;  // 小根堆 (dis, node)
    dis[s] = 0;
    pq.push({0, s});

    while (!pq.empty()) {
        auto [d, u] = pq.top();
        pq.pop();
        if (vis[u]) continue;   // 已确定最短距离
        vis[u] = true;

        for (auto [v, w] : g[u]) {
            if (dis[v] > dis[u] + w) {
                dis[v] = dis[u] + w;
                pq.push({dis[v], v});
            }
        }
    }
}
```

两点的最短距离（提前终止）

```cpp
ll dijkstra(int s, int t) {
    memset(dis, 0x3f, sizeof(dis));
    priority_queue<pii, vector<pii>, greater<pii>> pq;
    dis[s] = 0;
    pq.push({0, s});

    while (!pq.empty()) {
        auto [d, u] = pq.top();
        pq.pop();
        if (u == t) return d;   // t 已确定最短距离，直接返回
        if (vis[u]) continue;
        vis[u] = true;

        for (auto [v, w] : g[u])
            if (dis[v] > dis[u] + w) {
                dis[v] = dis[u] + w;
                pq.push({dis[v], v});
            }
    }
    return -1;   // 不可达
}
```

## 无权无向图求两点最短距离

```cpp
// 无权无向图求 s 到 t 的最短路径，返回路径上所有点（s 开头 t 结尾）
// 不连通时返回空数组；点编号 1..n
vector<int> shortestPath(int n, vector<int> adj[], int s, int t) {
    vector<int> pre(n + 1, -1);        // BFS 树中的前驱
    vector<bool> vis(n + 1, false);
    queue<int> q;
    q.push(s);
    vis[s] = true;
    while (!q.empty()) {
        int u = q.front(); q.pop();
        if (u == t) break;             // 弹出终点，提前结束
        for (int v : adj[u])
            if (!vis[v]) {
                vis[v] = true;
                pre[v] = u;
                q.push(v);
            }
    }
    if (!vis[t]) return {};            // 不可达

    vector<int> path;
    for (int v = t; v != -1; v = pre[v])   // 从 t 沿前驱回溯到 s
        path.push_back(v);
    reverse(path.begin(), path.end());
    return path;
}
```

## 输出 `__int128`

```cpp
void print128(__int128 x) {
    if (x == 0) { cout << '0'; return; }
    if (x < 0) { cout << '-'; x = -x; }
    string s;
    while (x > 0) {
        s += char('0' + x % 10);
        x /= 10;
    }
    reverse(s.begin(), s.end());
    cout << s;
}
```

## 位掩码枚举

- 某个元素选 / 不选
- 一个集合的所有子集
```cpp
for (int mask = 0; mask < (1 << k); mask++) {
    if (__builtin_popcount(mask) != n) continue;//限定了1的总数是n，不限定去掉即可

    vector<int> b(k);
    for (int i = 0; i < k; i++) {
        b[i] = (mask >> i) & 1;
    }

    // 此时 b 长度为 k，且恰好有 n 个 1
}
```

计数器（`n` 个变量各自取 `k` 个值）：
```cpp
vector<int> b(n, 0);
while (true) {
    // 处理当前 b

    int i = 0;                          // 从最低位找进位
    while (i < n && b[i] == k) b[i++] = 0;
    if (i == n) break;                  // 全部溢出：枚举完毕
    b[i]++;
}
```

## 离线排序 + 线性扫描 O（mlogm）

无论坐标多大，只需把所有区间按左端点排序，然后逐个合并。

```cpp
vector<pair<long long, long long>> mergeIntervals(vector<pair<long long, long long>>& intervals) {
    if (intervals.empty()) return {};
    
    // 1. 按左端点排序（n 再大也不怕，只排 m 个区间）
    sort(intervals.begin(), intervals.end());
    
    vector<pair<long long, long long>> res;
    long long curL = intervals[0].first;
    long long curR = intervals[0].second;
    
    for (int i = 1; i < intervals.size(); i++) {
        if (intervals[i].first <= curR) { 
            // 有交集（注意：如果 [1,2] 和 [3,4] 算相交，此处改成 <）
            curR = max(curR, intervals[i].second);
        } else {
            // 无交集，保存当前段
            res.push_back({curL, curR});
            curL = intervals[i].first;
            curR = intervals[i].second;
        }
    }
    res.push_back({curL, curR});
    return res;
}
```

适用场景：题目一次性给你所有区间（离线处理）。

## 平衡树动态维护（在线插入，O（mlogm））

如果区间是动态逐个添加的，每次插入后都要实时维护合并结果，可以用 std：：map（底层红黑树）按左端点存储区间。

```cpp
#include <bits/stdc++.h>
using namespace std;

map<long long, long long> mp; // key: 左端点, value: 右端点

// 插入新区间 [l, r]，自动合并相交区间
void addInterval(long long l, long long r) {
    // 1. 找到第一个左端点 > l 的区间
    auto it = mp.upper_bound(l);
    
    // 2. 检查前一个区间是否与当前相交
    if (it != mp.begin()) {
        auto prev_it = prev(it);
        if (prev_it->second >= l) { // 有交集
            l = prev_it->first;      // 扩展左边界
            r = max(r, prev_it->second);
            mp.erase(prev_it);       // 删掉旧区间
        }
    }
    
    // 3. 向后合并所有与 [l, r] 相交的区间
    while (it != mp.end() && it->first <= r) {
        r = max(r, it->second);
        it = mp.erase(it); // 删掉并移动迭代器
    }
    
    // 4. 插入合并后的新区间
    mp[l] = r;
}
```

## 差分数组

```cpp
// 定义
diff[i] = a[i] - a[i - 1]
// 从 diff 恢复原数组，只需做前缀和：
a[i] = a[i - 1] + diff[i]
// 要给 [l, r] 全部加 x：
diff[l] += x;
diff[r + 1] -= x;
```
