// Generated from src/content/posts/notes. Keep this list in sync by running
// `node scripts/generate-static-note-registry.mjs` (the build command does this).
export const STATIC_NOTES = new Map([
	[
		"notes/cpp-contest/cppstl",
		{
			"title": "C++STL",
			"description": "",
			"category": "C++ Contest",
			"tags": [
				"学习笔记",
				"C++",
				"算法竞赛"
			],
			"markdown": "## vector 数组\r\n\r\n| 代码                              | 算法复杂度  | 返回值类型 | 含义                                                                   |\r\n| ------------------------------- | ------ | ----- | -------------------------------------------------------------------- |\r\n| `c.front()`                     | $O(1)$ | 引用    | 返回容器中的第一个数据                                                          |\r\n| `c.back()`                      | $O(1)$ | 引用    | 返回容器中的最后一个数据                                                         |\r\n| `c.size()`                      | $O(1)$ |       | 返回实际数据个数（unsigned 类型）                                                 |\r\n| `c.begin()`                     | $O(1)$ | 迭代器   | 返回首元素的迭代器（通俗来说就是地址）                                                  |\r\n| `c.end()`                       | $O(1)$ | 迭代器   | 返回最后一个元素后一个位置的迭代器（地址）                                                |\r\n| `c.empty()`                     | $O(1)$ | bool  | 判断是否为空，为空返回真，反之返回假                                                   |\r\n| `c.reserve(sz)`                 |        |       | 为数组提前分配 `sz` 的内存大小，即改变了 `capacity` 的大小，主要是为了防止在 `push_back` 过程中多次的内存拷贝 |\r\n| `c.emplace_back(ele)`           | $O(1)$ |       | 在数组中加入一个数据，和 `push_back` 功能基本一样，在某些情况下比它效率更高，支持传入多个构造参数              |\r\n| `c.resize(n, v)`                |        |       | 改变数组大小为 `n`，`n` 个空间数值赋为 `v`，如果没有默认赋值为 `0`                                |\r\n| `c.insert(pos, x)`              | $O(N)$ |       | 向任意迭代器 `pos` 插入一个元素 `x`                                                 |\r\n| `c.erase(first, last)`          | $O(N)$ |       | 删除 `[first, last)` 的所有元素                                               |\r\n\r\n## stack 栈\r\n\r\n| 代码 | 含义 | 算法复杂度 |\r\n|------|------|------------|\r\n| `s.push(ele)` | 元素 `ele` 入栈，增加元素 | $O(1)$ |\r\n| `s.pop()` | 移除栈顶元素 | $O(1)$ |\r\n| `s.top()` | 取得栈顶元素（但不删除） | $O(1)$ |\r\n| `s.empty()` | 检测栈内是否为空，空为真 | $O(1)$ |\r\n| `s.size()` | 返回栈内元素的个数 | $O(1)$ |\r\n\r\n## queue 队列\r\n\r\n| 代码 | 含义 | 算法复杂度 |\r\n|------|------|------------|\r\n| `q.front()` | 返回队首元素 | $O(1)$ |\r\n| `q.back()` | 返回队尾元素 | $O(1)$ |\r\n| `q.push(element)` | 尾部添加一个元素 `element` 进队 | $O(1)$ |\r\n| `q.pop()` | 删除第一个元素 出队 | $O(1)$ |\r\n| `q.size()` | 返回队列中元素个数，返回值类型 `unsigned int` | $O(1)$ |\r\n| `q.empty()` | 判断是否为空，队列为空，返回 `true` | $O(1)$ |\r\n\r\n## map\r\n\r\n| 代码                     | 含义                                                                                  | 复杂度           |\r\n| ---------------------- | ----------------------------------------------------------------------------------- | ------------- |\r\n| `mp.find(key)`         | 返回键为 key 的映射的迭代器 注意：用 find 函数来定位数据出现位置，它返回一个迭代器。当数据存在时，返回数据所在位置的迭代器，数据不存在时，返回 `mp.end()` | $O(logN)$       |\r\n| `mp.erase(it)`         | 删除迭代器对应的键和值                                                                         | $O(logN)$       |\r\n| `mp.erase(key)`        | 根据映射的键删除键和值                                                                         | $O(logN)$       |\r\n| `mp.erase(first,last)` | 删除左闭右开区间迭代器对应的键和值                                                                   | O（last-first） |\r\n| `mp.size()`            | 返回映射的对数                                                                             | $O(1)$        |\r\n| `mp.insert()`          | 插入元素，插入时要构造键值对                                                                      | $O(N)$        |\r\n| `mp.empty()`           | 如果 map 为空，返回 true，否则返回 false                                                            | $O(1)$        |\r\n| `mp.begin()`           | 返回指向 map 第一个元素的迭代器（地址）                                                                | $O(1)$        |\r\n| `mp.end()`             | 返回指向 map 尾部的迭代器（最后一个元素的**下一个**地址）                                                     | $O(1)$        |\r\n| `mp.count(key)`        | 查看元素是否存在，因为 map 中键是唯一的，所以存在返回 1，不存在返回 0                                                 | $O(logN)$       |\r\n| `mp.lower_bound()`     | 返回一个迭代器，指向键值>= **key** 的第一个元素                                                        |               |\r\n\r\n- map：内部用红黑树实现，具有自动排序（按键从小到大）功能。\r\n- unordered_map：内部用哈希表实现，内部元素无序杂乱。\r\n\r\n## set\r\n\r\n| 代码                     | 复杂度     | 含义                                            |\r\n| ---------------------- | ------- | --------------------------------------------- |\r\n| `s.begin()`            | $O(1)$    | 返回 set 容器的第一个元素的地址（迭代器）                         |\r\n| `s.end()`              | $O(1)$    | 返回 set 容器的最后一个元素的下一个地址（迭代器）                     |\r\n| `s.clear()`            | $O(N)$    | 删除 set 容器中的所有的元素，无返回值                           |\r\n| `s.empty()`            | $O(1)$    | 判断 set 容器是否为空                                   |\r\n| `s.insert(element)`    | $O(logN)$ | 插入一个元素                                        |\r\n| `s.size()`             | $O(1)$    | 返回当前 set 容器中的元素个数                               |\r\n| `erase(iterator)`      | $O(logN)$ | 删除定位器 iterator 指向的值                             |\r\n| `erase(first, second）` |         | 删除定位器 first 和 second 之间的值                         |\r\n| `erase(key_value)`     | $O(logN)$ | 删除键值 key_value 的值                               |\r\n| `s.find(element)`      |         | 查找 set 中的某一元素，有则返回该元素对应的迭代器，无则返回结束迭代器           |\r\n| `s.count(element)`     |         | 查找 set 中的元素出现的个数，由于 set 中元素唯一，此函数相当于查询 element 是否出现 |\r\n| `s.lower_bound(k)`     | $O(logN)$ | 返回大于等于 k 的第一个元素的迭代器                             |\r\n\r\n## string\r\n\r\n- 获取字符串长度\r\n\r\n| 代码                      | 含义                                     |\r\n| ----------------------- | -------------------------------------- |\r\n| `s.size()` 和 `s.length()` | 返回 string 对象的字符个数，他们执行效果相同。|\r\n| `s.max_size()`          | 返回 string 对象最多包含的字符数，超出会抛出 length_error 异常 |\r\n\r\n- 插入\r\n\r\n| 代码                          | 含义                |\r\n| --------------------------- | ----------------- |\r\n| `s.push_back()`             | 在末尾插入             |\r\n| `s.insert(pos,element)`     | 在 pos 位置插入 element   |\r\n| 例：`s.insert(s.begin(),'1')` | 在第一个位置插入 1 字符       |\r\n| `s.append(str)`             | 在 s 字符串结尾添加 str 字符串   |\r\n\r\n- 删除\r\n\r\n| 代码 | 含义 |\r\n|------|------|\r\n| `erase(iterator p)` | 删除字符串中 p 所指的字符 |\r\n| `erase(iterator first, iterator last)` | 删除字符串中迭代器区间 `[first,last)` 上所有字符 |\r\n| `erase(pos, len)` | 删除字符串中从索引位置 pos 开始的 len 个字符 |\r\n| `clear()` | 删除字符串中所有字符 |\r\n\r\n- 字符替换\r\n\r\n| 代码                       | 含义                                         |\r\n| ------------------------ | ------------------------------------------ |\r\n| `s.replace(pos,n,str)`   | 把当前字符串从索引 pos 开始的 n 个字符替换为 str                  |\r\n| `s.replace(pos,n,n1,c)`  | 把当前字符串从索引 pos 开始的 n 个字符替换为 n1 个字符 c               |\r\n| `s.replace(it1,it2,str)` | 把当前字符串 `[it1,it2)` 区间替换为 str    it1，it2 为迭代器哦 |\r\n\r\n- 分割\r\n\r\n| 代码 | 含义 |\r\n|------|------|\r\n| `s.substr(pos,n)` | 截取从 `pos` 索引开始的 `n` 个字符 |\r\n\r\n- 查找\r\n\r\n| 代码                          | 含义                                                          |\r\n| --------------------------- | ----------------------------------------------------------- |\r\n| `s.find(str, pos)`          | 在当前字符串的 `pos` 索引位置（默认为 0）开始，查找子串 `str`，返回找到的位置索引，`-1` 表示查找不到子串  |\r\n| `s.find(c, pos)`            | 在当前字符串的 `pos` 索引位置（默认为 0）开始，查找字符 `c`，返回找到的位置索引，`-1` 表示查找不到字符    |\r\n| `s.find_first_of(str, pos)` | 在当前字符串的 `pos` 索引位置（默认为 0）开始，查找子串 `s` 的字符，返回找到的位置索引，`-1` 表示查找不到字符 |\r\n| `s.find_last_of(str, pos)`  | 在当前字符串的 `pos` 索引位置开始，查找最后一个位于子串 `s` 的字符，返回找到的位置索引，`-1` 表示查找不到字符  |\r\n\r\n## lower_bound 二分查找\r\n\r\n- 时间复杂度 $O(\\log  n)$\r\n```cpp\r\n//在 a 数组中查找第一个大于等于 x 的元素，返回该元素的地址，如果未找到，返回尾地址的下一个位置的地址\r\nlower_bound(a,a+n,x);\r\n```\r\n\r\n## reverse 反转数组\r\n\r\n- 时间复杂度 $O(N)$\r\n```cpp\r\nreverse(beg,end);\r\n```\r\n\r\n## sort 排序\r\n\r\n- 对数组正常升序排序\r\n```cpp\r\nint a[N]; // 普通数组定义\r\n// 对 a 数组的[1, n]位置进行从小到大排序\r\nsort(a + 1, a + 1 + n);\r\n\r\nvector<int> b(n + 1); // vector数组定义\r\nsort(b.begin() + 1, b.end());\r\n```\r\n\r\n- 使用第三个参数，进行降序排序\r\n```cpp\r\n//对a数组的[0, n-1]位置从大到小排序\r\nsort(a, a + n, greater<int>());\r\n//对a数组的[0, n-1]位置从小到大排序\r\nsort(a, a + n, less<int>());\r\n\r\nvector<int> b(n + 1);\r\nsort(b.begin() + 1, b.end()); // 升序\r\nsort(b.begin() + 1, b.end(), greater<int>()); // 降序\r\n```\r\n\r\n## stoi 字符串转数字\r\n\r\n- 将对应 string 类型字符串转换为数字（`int` 型）\r\n```cpp\r\nstoi(const string*);\r\n```\r\n\r\n## \\_\\_gcd\r\n\r\n- 求 a 和 b 的最大公约数\r\n```cpp\r\n__gcd(a, b);\r\n```\r\n\r\n## priority_queue 大根堆\r\n\r\n```cpp\r\npriority_queue<int> pq;\r\n\r\n// 插入\r\npq.push(5);              // O(log n)\r\n\r\n// 访问堆顶\r\npq.top();                // 返回最大元素（const 引用）\r\n\r\n// 删除堆顶\r\npq.pop();                // 移除最大元素，O(log n)\r\n\r\n// 大小和判空\r\npq.size();\r\npq.empty();\r\n\r\n// 清空（没有 clear，需要重新赋值）\r\npq = priority_queue<int>();\r\n// 或\r\npq = {};\r\n```",
			"published": "2026-09-15",
			"updated": "2026-09-16",
			"history": []
		}
	],
	[
		"notes/cpp-contest/practical-cpp",
		{
			"title": "Practical cpp",
			"description": "",
			"category": "C++ Contest",
			"tags": [
				"学习笔记",
				"C++",
				"算法竞赛"
			],
			"markdown": "## 基础模板\r\n\r\n```cpp\r\n#include <bits/stdc++.h>  \r\nusing namespace std;  \r\n#define ll long long  \r\n  \r\nint main() {  \r\n    ios::sync_with_stdio(false);  \r\n    cin.tie(0);  \r\n    return 0;  \r\n}\r\n```\r\n\r\n## 数字快速幂\r\n\r\n```cpp\r\nlong long fast_pow(long long base, long long exponent) {\r\n    long long result = 1;\r\n    // base %= mod;\r\n    while (exponent > 0) { \r\n        if (exponent & 1) { \r\n            result *= base;//result = (result * base) % mod;\r\n        }\r\n        base *= base;//base = (base * base) % mod;   \r\n        exponent >>= 1;    \r\n    }\r\n    return result;\r\n}\r\n```\r\n\r\n## 埃氏素数筛法\r\n\r\n>（假设要筛出 $2e6$ 以内的素数）\r\n\r\n```cpp\r\nint flag[2000010];\r\nvoid init() {\r\n//埃氏筛初始化 \r\nfor (int a=2;a<=2000000;a++) { \r\n\tif (flag[a]) continue; \r\n\tfor (int b=a+a;b<=2000000;b+=a) flag[b]=1; \r\n\t} \r\n}\r\n```\r\n\r\n## 二分查找（手动）\r\n\r\n>找数组中第一个大于等于 $x$ 的元素及其下标\r\n\r\n```cpp\r\npair<int, int> findFirstGE(const int a[], int n, int x) {  \r\n    int left = 0;  \r\n    int right = n - 1;  \r\n    int res_idx = -1; // 初始化为-1，表示未找到  \r\n    int res_val = -1;  \r\n    while (left <= right) {  \r\n        // 计算mid，避免left+right溢出（等价于(left+right)/2，但更安全）  \r\n        int mid = left + (right - left) / 2;  \r\n        if (a[mid] >= x) {  \r\n            res_idx = mid;  \r\n            res_val = a[mid];  \r\n            right = mid - 1;  \r\n        } else left = mid + 1;  \r\n    }  \r\n    return {res_idx, res_val};  \r\n}\r\n```\r\n\r\n## 计算两组区间的交集和并集\r\n\r\n```cpp\r\n// 计算两个区间的交集，返回空区间（l > r）表示无交集  \r\npair<ll, ll> get_intersection(ll l1, ll r1, ll l2, ll r2) {  \r\n    ll inter_l = max(l1, l2);  \r\n    ll inter_r = min(r1, r2);  \r\n    return {inter_l, inter_r}; }  \r\n  \r\n// 计算一组区间的并集总长度  \r\nll calculate_union_length(vector<pair<ll, ll>>& intervals) {  \r\n    if (intervals.empty()) return 0;  \r\n    sort(intervals.begin(), intervals.end());  \r\n    ll total = 0;  \r\n    ll cur_l = intervals[0].first;  \r\n    ll cur_r = intervals[0].second;  \r\n    for (size_t i = 1; i < intervals.size(); ++i) {  \r\n        ll l = intervals[i].first;  \r\n        ll r = intervals[i].second;  \r\n        if (l <= cur_r) {             cur_r = max(cur_r, r);  \r\n        } else {             total += cur_r - cur_l;  \r\n            cur_l = l;  \r\n            cur_r = r;  \r\n        }  \r\n    }  \r\n    total += cur_r - cur_l;  \r\n    return total;  \r\n}  \r\n```\r\n\r\n## 读行，按空格分字符串\r\n\r\n```cpp\r\nstring line;  \r\nwhile (getline(cin, line)){ }\r\n\r\nvector<string> split(const string &s){  \r\n    vector<string> res;  \r\n    stringstream ss(s);  \r\n    string temp;  \r\n    while(ss>>temp){  \r\n        res.push_back(temp);  \r\n    }  \r\n    return res;  \r\n}\r\n```\r\n\r\n# BFS 广度优先搜索模板\r\n\r\n```cpp\r\nvoid bfs(int u) {\r\n  queue<int> Q;\r\n  while (!Q.empty()) Q.pop();\r\n  Q.push(u);\r\n  vis[u] = 1;\r\n  d[u] = 0;\r\n  p[u] = -1;\r\n  while (!Q.empty()) {\r\n    u = Q.front();\r\n    Q.pop();\r\n    for (int i = head[u]; i; i = e[i].nxt) {\r\n      if (!vis[e[i].to]) {\r\n        Q.push(e[i].to);\r\n        vis[e[i].to] = 1;\r\n        d[e[i].to] = d[u] + 1;\r\n        p[e[i].to] = u;\r\n      }\r\n    }\r\n  }\r\n}\r\n\r\nvoid restore(int x) {\r\n  vector<int> res;\r\n  for (int v = x; v != -1; v = p[v]) {\r\n    res.push_back(v);\r\n  }\r\n  std::reverse(res.begin(), res.end());\r\n  for (int i = 0; i < res.size(); ++i) printf(\"%d\", res[i]);\r\n  puts(\"\");\r\n}\r\n```\r\n\r\n## DFS 深度优先搜索\r\n\r\n```cpp\r\nvector<vector<int>> adj;  // 邻接表\r\nvector<bool> vis;         // 记录节点是否已经遍历\r\n\r\nvoid dfs(int s) {\r\n  stack<int> st;\r\n  st.push(s);\r\n  vis[s] = true;\r\n\r\n  while (!st.empty()) {\r\n    int u = st.top();\r\n    st.pop();\r\n\r\n    for (int v : adj[u]) {\r\n      if (!vis[v]) {\r\n        vis[v] = true;  // 确保栈里没有重复元素\r\n        st.push(v);\r\n      }\r\n    }\r\n  }\r\n}\r\n```\r\n\r\n# pair 对 int 的哈希函数\r\n\r\n低版本适配：\r\n```cpp\r\nstruct PairHash {\r\n\t\tsize_t operator()(const std::pair<int, int>& p) const {\r\n\t\t\tsize_t h1 = std::hash<int>()(p.first);\r\n\t\t\tsize_t h2 = std::hash<int>()(p.second);\r\n\t\t\treturn h1 ^ (h2 << 1);\r\n\t\t}\r\n\t};\r\nstd::unordered_map<std::pair<int, int>, bool, PairHash> istrash;\r\n```\r\n\r\n# 自定义结构体数组按成员排序\r\n\r\n```cpp \r\nsort(arr, arr + n, [](const Student& a, const Student& b) { \r\n\t\treturn a.score < b.score; // 从小到大：a.成员 < b.成员 \r\n});\r\n```\r\n\r\n# 分解质因数 \r\n\r\n> 结果数组不递减地存储了 $n$ 的所有最小质因数。时间复杂度 $O(\\sqrt{ n })$。\r\n\r\n```cpp\r\nvector<ll> factor(ll n) {  \r\n    vector<ll> res;  \r\n    for (ll i = 2; i * i <= n; i++) {  \r\n        while (n % i == 0) {  \r\n            res.push_back(i);  \r\n            n /= i;  \r\n        }  \r\n    }  \r\n    if (n > 1) res.push_back(n);  \r\n    return res;  \r\n}  \r\n```\r\n\r\n## Dijkstra 求一个点到其余所有点的最短距离（有权图）\r\n\r\n```cpp\r\n#include <bits/stdc++.h>\r\nusing namespace std;\r\nusing ll = long long;\r\nusing pii = pair<int, int>;\r\n\r\nconst int N = 100005;\r\nconst ll INF = 0x3f3f3f3f3f3f3f3fLL;\r\n\r\nvector<pii> g[N];   // g[u] = {(v, w), ...}\r\nll dis[N];// 每个点到源点的最短距离\r\nbool vis[N];\r\nint n, m, s;\r\n\r\nvoid dijkstra(int s) {\r\n    memset(dis, 0x3f, sizeof(dis));\r\n    priority_queue<pii, vector<pii>, greater<pii>> pq;  // 小根堆 (dis, node)\r\n    dis[s] = 0;\r\n    pq.push({0, s});\r\n\r\n    while (!pq.empty()) {\r\n        auto [d, u] = pq.top();\r\n        pq.pop();\r\n        if (vis[u]) continue;   // 已确定最短距离\r\n        vis[u] = true;\r\n\r\n        for (auto [v, w] : g[u]) {\r\n            if (dis[v] > dis[u] + w) {\r\n                dis[v] = dis[u] + w;\r\n                pq.push({dis[v], v});\r\n            }\r\n        }\r\n    }\r\n}\r\n```\r\n\r\n两点的最短距离（提前终止）\r\n\r\n```cpp\r\nll dijkstra(int s, int t) {\r\n    memset(dis, 0x3f, sizeof(dis));\r\n    priority_queue<pii, vector<pii>, greater<pii>> pq;\r\n    dis[s] = 0;\r\n    pq.push({0, s});\r\n\r\n    while (!pq.empty()) {\r\n        auto [d, u] = pq.top();\r\n        pq.pop();\r\n        if (u == t) return d;   // t 已确定最短距离，直接返回\r\n        if (vis[u]) continue;\r\n        vis[u] = true;\r\n\r\n        for (auto [v, w] : g[u])\r\n            if (dis[v] > dis[u] + w) {\r\n                dis[v] = dis[u] + w;\r\n                pq.push({dis[v], v});\r\n            }\r\n    }\r\n    return -1;   // 不可达\r\n}\r\n```\r\n\r\n## 无权无向图求两点最短距离\r\n\r\n```cpp\r\n// 无权无向图求 s 到 t 的最短路径，返回路径上所有点（s 开头 t 结尾）\r\n// 不连通时返回空数组；点编号 1..n\r\nvector<int> shortestPath(int n, vector<int> adj[], int s, int t) {\r\n    vector<int> pre(n + 1, -1);        // BFS 树中的前驱\r\n    vector<bool> vis(n + 1, false);\r\n    queue<int> q;\r\n    q.push(s);\r\n    vis[s] = true;\r\n    while (!q.empty()) {\r\n        int u = q.front(); q.pop();\r\n        if (u == t) break;             // 弹出终点，提前结束\r\n        for (int v : adj[u])\r\n            if (!vis[v]) {\r\n                vis[v] = true;\r\n                pre[v] = u;\r\n                q.push(v);\r\n            }\r\n    }\r\n    if (!vis[t]) return {};            // 不可达\r\n\r\n    vector<int> path;\r\n    for (int v = t; v != -1; v = pre[v])   // 从 t 沿前驱回溯到 s\r\n        path.push_back(v);\r\n    reverse(path.begin(), path.end());\r\n    return path;\r\n}\r\n```\r\n\r\n## 输出 `__int128`\r\n\r\n```cpp\r\nvoid print128(__int128 x) {\r\n    if (x == 0) { cout << '0'; return; }\r\n    if (x < 0) { cout << '-'; x = -x; }\r\n    string s;\r\n    while (x > 0) {\r\n        s += char('0' + x % 10);\r\n        x /= 10;\r\n    }\r\n    reverse(s.begin(), s.end());\r\n    cout << s;\r\n}\r\n```\r\n\r\n## 位掩码枚举\r\n\r\n- 某个元素选 / 不选\r\n- 一个集合的所有子集\r\n```cpp\r\nfor (int mask = 0; mask < (1 << k); mask++) {\r\n    if (__builtin_popcount(mask) != n) continue;//限定了1的总数是n，不限定去掉即可\r\n\r\n    vector<int> b(k);\r\n    for (int i = 0; i < k; i++) {\r\n        b[i] = (mask >> i) & 1;\r\n    }\r\n\r\n    // 此时 b 长度为 k，且恰好有 n 个 1\r\n}\r\n```\r\n\r\n计数器（`n` 个变量各自取 `k` 个值）：\r\n```cpp\r\nvector<int> b(n, 0);\r\nwhile (true) {\r\n    // 处理当前 b\r\n\r\n    int i = 0;                          // 从最低位找进位\r\n    while (i < n && b[i] == k) b[i++] = 0;\r\n    if (i == n) break;                  // 全部溢出：枚举完毕\r\n    b[i]++;\r\n}\r\n```\r\n\r\n## 离线排序 + 线性扫描 O（mlogm）\r\n\r\n无论坐标多大，只需把所有区间按左端点排序，然后逐个合并。\r\n\r\n```cpp\r\nvector<pair<long long, long long>> mergeIntervals(vector<pair<long long, long long>>& intervals) {\r\n    if (intervals.empty()) return {};\r\n    \r\n    // 1. 按左端点排序（n 再大也不怕，只排 m 个区间）\r\n    sort(intervals.begin(), intervals.end());\r\n    \r\n    vector<pair<long long, long long>> res;\r\n    long long curL = intervals[0].first;\r\n    long long curR = intervals[0].second;\r\n    \r\n    for (int i = 1; i < intervals.size(); i++) {\r\n        if (intervals[i].first <= curR) { \r\n            // 有交集（注意：如果 [1,2] 和 [3,4] 算相交，此处改成 <）\r\n            curR = max(curR, intervals[i].second);\r\n        } else {\r\n            // 无交集，保存当前段\r\n            res.push_back({curL, curR});\r\n            curL = intervals[i].first;\r\n            curR = intervals[i].second;\r\n        }\r\n    }\r\n    res.push_back({curL, curR});\r\n    return res;\r\n}\r\n```\r\n\r\n适用场景：题目一次性给你所有区间（离线处理）。\r\n\r\n## 平衡树动态维护（在线插入，O（mlogm））\r\n\r\n如果区间是动态逐个添加的，每次插入后都要实时维护合并结果，可以用 std：：map（底层红黑树）按左端点存储区间。\r\n\r\n```cpp\r\n#include <bits/stdc++.h>\r\nusing namespace std;\r\n\r\nmap<long long, long long> mp; // key: 左端点, value: 右端点\r\n\r\n// 插入新区间 [l, r]，自动合并相交区间\r\nvoid addInterval(long long l, long long r) {\r\n    // 1. 找到第一个左端点 > l 的区间\r\n    auto it = mp.upper_bound(l);\r\n    \r\n    // 2. 检查前一个区间是否与当前相交\r\n    if (it != mp.begin()) {\r\n        auto prev_it = prev(it);\r\n        if (prev_it->second >= l) { // 有交集\r\n            l = prev_it->first;      // 扩展左边界\r\n            r = max(r, prev_it->second);\r\n            mp.erase(prev_it);       // 删掉旧区间\r\n        }\r\n    }\r\n    \r\n    // 3. 向后合并所有与 [l, r] 相交的区间\r\n    while (it != mp.end() && it->first <= r) {\r\n        r = max(r, it->second);\r\n        it = mp.erase(it); // 删掉并移动迭代器\r\n    }\r\n    \r\n    // 4. 插入合并后的新区间\r\n    mp[l] = r;\r\n}\r\n```\r\n\r\n## 差分数组\r\n\r\n```cpp\r\n// 定义\r\ndiff[i] = a[i] - a[i - 1]\r\n// 从 diff 恢复原数组，只需做前缀和：\r\na[i] = a[i - 1] + diff[i]\r\n// 要给 [l, r] 全部加 x：\r\ndiff[l] += x;\r\ndiff[r + 1] -= x;\r\n```",
			"published": "2026-09-15",
			"updated": "2026-09-16",
			"history": []
		}
	],
	[
		"notes/linux/全局",
		{
			"title": "全局",
			"description": "",
			"category": "Linux",
			"tags": [
				"学习笔记",
				"Linux"
			],
			"markdown": "`pwd`：显示当前目录\r\n`ls`：列出目录内容  \r\n\t`ls -l`：详细列表\r\n\t`ls -a`：包含隐藏文件\r\n`mkdir 名称`：新建目录\r\n`touch 文件名`：新建空文件或更新修改时间\r\n`cp 源 目标`：复制文件或目录（目录通常加 `-r`）\r\n`mv 源 目标`：移动或重命名\r\n[rm和其他的删除操作](/posts/notes/linux/links/delete/)\r\n`cat 文件`：输出文件内容\r\n`less 文件`：分页查看文件\r\n`head -n 10 文件`：查看前 10 行\r\n`tail -n 10 文件`：查看后 10 行\r\n[grep 和 find 的查找](/posts/notes/linux/links/find/)\r\n[sed 的替换](/posts/notes/linux/links/replace/)\r\n`chmod 权限 文件`：修改权限，例如 `chmod +x script.sh`\r\n`chown 用户:组 文件`：修改文件所有者\r\n`kill PID`：终止进程\r\n`df -h`：查看磁盘空间\r\n`du -sh 目录`：查看目录占用空间\r\n`free -h`：查看内存使用情况\r\n`uname -a`：查看系统信息\r\n`ip addr`：查看网络接口和 IP\r\n`ping 地址`：测试网络连通性\r\n`curl URL`：请求网页或接口\r\n\r\n查找 python 的安装位置：`which python` 或 `which python3`",
			"published": "2026-09-15",
			"updated": "2026-09-15",
			"history": []
		}
	],
	[
		"notes/linux/links/delete",
		{
			"title": "delete",
			"description": "",
			"category": "Linux",
			"tags": [
				"学习笔记",
				"Linux"
			],
			"markdown": "### 1. `rm`：删除文件或目录\r\n\r\n```bash\r\nrm [参数] 文件或目录\r\n```\r\n\r\n| 参数 | 作用 |\r\n|---|---|\r\n| `-i` | 删除前逐个确认 |\r\n| `-I` | 删除多个文件或递归删除前确认一次 |\r\n| `-f` | 强制删除，不提示；不存在也不报错 |\r\n| `-r` / `-R` | 递归删除目录及其内容 |\r\n| `-d` | 删除空目录（部分系统支持） |\r\n| `-v` | 显示删除过程 |\r\n| `--` | 结束参数解析，用于文件名以 `-` 开头的情况 |\r\n\r\n`rm -rf` 风险很高：\r\n\r\n```bash\r\nrm -rf directory\r\n```\r\n\r\n其中 `-r` 表示递归，`-f` 表示强制\r\n\r\n### 2. `rmdir`：删除空目录\r\n\r\n```bash\r\nrmdir [参数] 目录\r\n```\r\n\r\n| 参数 | 作用 |\r\n|---|---|\r\n| `-p` | 删除目录，并继续删除变空的父目录 |\r\n| `-v` | 显示处理过程 |\r\n| `--ignore-fail-on-non-empty` | 目录非空时不报告失败 |\r\n\r\n如果目录不是空的，`rmdir` 默认不会删除，因此比 `rm -r` 安全。\r\n\r\n### 3. `unlink`：删除单个文件\r\n\r\n```bash\r\nunlink 文件\r\n```\r\n\r\n它通常一次只处理一个文件，不能递归删除目录。\r\n\r\n### 4. `find -delete`：按条件批量删除\r\n\r\n```bash\r\nfind 路径 条件 -delete\r\n\r\nfind ./logs -type f -name '*.log' -delete\r\nfind ./cache -type f -mtime +30 -delete\r\nfind ./temp -type d -empty -delete\r\n```\r\n\r\n把 `-delete` 换成 `-print` 检查匹配结果：\r\n\r\n```bash\r\nfind ./logs -type f -name '*.log' -print\r\n```\r\n\r\n注意：`-delete` 会隐式启用深度优先遍历，条件顺序也会影响结果。",
			"published": "2026-09-15",
			"updated": "2026-09-15",
			"history": []
		}
	],
	[
		"notes/linux/links/find",
		{
			"title": "find",
			"description": "",
			"category": "Linux",
			"tags": [
				"学习笔记",
				"Linux"
			],
			"markdown": "`grep` 用来“在文件内容里找文字”，`find` 用来“按文件名、位置、时间等找文件”。\r\n\r\n## grep\r\n\r\n1. **查找行**，会返回所有含有目标词的整行，并显示行号\r\n```bash\r\ngrep -n \"hello\" file.txt\r\n```\r\n2. **忽略大小写**\r\n```bash\r\ngrep -i \"hello\" file.txt\r\n```\r\n3. **递归搜索当前目录及子目录中的内容**\r\n```bash\r\ngrep -r \"hello\" .\r\n```\r\n4. **显示“不以 `#` 开头”的行**，常用来过滤注释\r\n```bash\r\ngrep -v \"^#\" config.txt\r\n```\r\n\r\n## find\r\n\r\n1. 在当前目录及子目录中找（最基础版）\r\n```bash\r\nfind . -name \"file.txt\"\r\n# 文件名可换成类似 \"*.py\" 的通配符\r\n```\r\n2. 指定起点递归搜索，并指定匹配类型 \r\n```bash\r\nfind ~/project -type d -name \"src\"\r\n# find 搜索起点 -type 只匹配目录(directory) -name 要匹配的项目名称\r\n# 除了 d，还有 f（普通文件），l（符号链接）\r\n# ~/project 换成 . 就是当前目录\r\n```\r\n3. 忽略大小写\r\n```bash\r\nfind . -type f -iname \"*.log\"\r\n# 关键参数 -iname\r\n```\r\n\r\n## 联合搜索\r\n\r\n```bash\r\nfind . -name \"*.py\" -exec grep -nH \"to be found\" {} +\r\n# -exec 的前面意为从当前目录开始递归查找到的所有后缀 .py 的文件，后面是对每一个找到的文件，找里面的 to be found\r\n# -n 显示行号，-H 显示文件名\r\n```\r\n\r\n`-exec ... {} +`：对前面语句的结果执行后面语句的命令",
			"published": "2026-09-15",
			"updated": "2026-09-15",
			"history": []
		}
	],
	[
		"notes/linux/links/replace",
		{
			"title": "replace",
			"description": "",
			"category": "Linux",
			"tags": [
				"学习笔记",
				"Linux"
			],
			"markdown": "## 一、`sed`\r\n\r\n```bash\r\nsed -i 's/要替换的内容/替换后的内容/g' 文件名\r\n```\r\n\r\n- `-i`：直接修改原文件（不加就是只打印到屏幕，不改文件，可以不加作为预览）\r\n- `g`：一行里替换所有匹配（不加 `g` 只替换每行第一个）\r\n\r\n**例子：**\r\n\r\n```bash\r\n# 把文件里所有 cat 换成 dog\r\nsed -i 's/cat/dog/g' notes.txt\r\n\r\n# 用扩展正则（+ ? | () 不用反斜杠），-E 或 -r\r\nsed -i -E 's/[0-9]+/N/g' data.txt\r\n\r\n# 捕获组：把 name: 张三  改成  张三 (name)\r\nsed -i -E 's/(name): *(.+)/\\2 (\\1)/' info.txt\r\n\r\n# 当前目录所有 txt\r\nsed -i 's/旧/新/g' *.txt\r\n\r\n# 递归当前目录及其子目录和子文件的所有 .md\r\nfind . -name '*.md' -exec sed -i 's/旧/新/g' {} +\r\n\r\n# 改之前可以先备份\r\nsed -i.bak 's/旧/新/g' file.txt     # 会生成 file.txt.bak\r\n```\r\n\r\n## 二、`perl`（支持更强正则）\r\n\r\n需要 `\\d`、前后查找、非贪婪等高级语法时：\r\n\r\n```bash\r\nperl -i -pe 's/\\d+/NUM/g' file.txt         # 原地修改\r\nperl -i.bak -pe 's/(\\w+)@(\\w+)/\\1[at]\\2/g' file.txt\r\n```\r\n\r\n- `-p` 逐行处理、自动打印\r\n- `-e` 后面是表达式\r\n- `-i` 原地改（`-i.bak` 备份）\r\n\r\n## 三、vim 本身的替换功能\r\n\r\n想边看边改、逐处确认，在 vim 里：\r\n\r\n```vim\r\n:%s/正则/替换/gc\r\n```\r\n- `%` 整个文件，`g` 全部，`c` 每处**询问确认**（`y`/`n`）\r\n- 不加 `c` 就是全部直接替换\r\n\r\n> sed 的多个替换之间用 ` ; ` 分隔，而 vim 里用管道符 `|`",
			"published": "2026-09-15",
			"updated": "2026-09-15",
			"history": []
		}
	],
	[
		"notes/linux/neovim常用指令",
		{
			"title": "Neovim常用指令",
			"description": "",
			"category": "Linux",
			"tags": [
				"学习笔记",
				"Linux"
			],
			"markdown": "## Neovim\r\n\r\n| 操作                | 按键/命令                           |\r\n| ----------------- | ------------------------------- |\r\n| 保存                | `:w`                            |\r\n| 退出                | `:q`                            |\r\n| 保存并退出             | `:wq`                           |\r\n| 强制退出、不保存          | `:q!`                           |\r\n| **撤销** / 重做       | `u` / `Ctrl + r`（不是 `Ctrl + z`） |\r\n| 复制当前行             | `yy`                            |\r\n| 删除/剪切当前行          | `dd`                            |\r\n| 粘贴到光标后 / 前        | `p` / `P`                       |\r\n| 查找关键词；下一个 / 上一个结果 | `/关键词` 后回车；`n` / `N`            |\r\n| 跳到指定行             | `:行号`，如 `:20`                   |\r\n| 跳到文件开头 / 结尾       | `gg` / `G`                      |\r\n| 运行终端命令            | `:!命令`，如 `:!python3 main.py`    |\r\n| 跳到本行最开头（含缩进）      | `0`                             |\r\n| 跳到本行第一个非空字符       | `^`                             |\r\n| 跳到本行末尾            | `$`                             |\r\n| 向后跳一个单词开头         | `w`                             |\r\n| 向前跳一个单词开头         | `b`                             |\r\n| 跳到当前/下一个单词结尾      | `e`                             |\r\n| 选中字符后移动选择范围       | `v`，再用方向键或 `w`、`e`、`$`          |\r\n| 选中整行              | `V`                             |\r\n| 矩形块选中             | `Ctrl + v`                      |\r\n| 全选                | `ggVG`                          |\r\n| 复制选中内容            | `y`                             |\r\n| 剪切选中内容            | `d`                             |",
			"published": "2026-09-15",
			"updated": "2026-09-15",
			"history": []
		}
	],
	[
		"notes/python-contest/算法",
		{
			"title": "算法",
			"description": "",
			"category": "Python Contest",
			"tags": [
				"学习笔记",
				"Python",
				"算法竞赛"
			],
			"markdown": "## 埃氏筛\r\n\r\n```python\r\nis_prime=[True]*(n+1)\r\nis_prime[1]=is_prime[0]=False # 1 和 0 不是素数\r\n\r\nfor i in range(2,int(math.sqrt(n))+1): # 2 到根号 n\r\n\tif is_prime(i): # i 是素数\r\n\t\tfor j in range(i*i,n+1,i): # 把后面的 i 的倍数全部标记为非素数，步长 i\r\n\t\t\tis_prime[j]=False\r\n```\r\n时间复杂度 $O(nloglogn)$",
			"published": "2026-09-15",
			"updated": "2026-09-16",
			"history": []
		}
	],
	[
		"notes/python-contest/dict-哈希字典",
		{
			"title": "dict（哈希字典）",
			"description": "",
			"category": "Python Contest",
			"tags": [
				"学习笔记",
				"Python",
				"算法竞赛"
			],
			"markdown": "```python\r\n# 初始化\r\nmp = {} \r\n\r\n# 赋值\r\nmp[\"apple\"] = 3 \r\n\r\n# 判断键是否存在\r\nif \"apple\" in mp:\r\n    print(mp[\"apple\"])\r\n    \r\n# 遍历\r\nfor key, value in mp.items():\r\n    print(key, value)\r\n    \r\n# 安全获取值 .get(键,默认值) 若键不存在则返回默认值\r\nmp.get(\"orange\", 0)\r\n```\r\n\r\n如果只需要存“某个元素是否出现过”，可以用 `set`，它也是基于哈希表实现的：\r\n\r\n```python\r\nseen = set()\r\nseen.add(\"apple\")\r\nprint(\"apple\" in seen)  # True\r\n```",
			"published": "2026-09-15",
			"updated": "2026-09-16",
			"history": []
		}
	],
	[
		"notes/python-contest/io",
		{
			"title": "IO",
			"description": "",
			"category": "Python Contest",
			"tags": [
				"学习笔记",
				"Python",
				"算法竞赛"
			],
			"markdown": "## 输出\r\n\r\n```python\r\nprint(a,b,c,sep='-') # 分隔符：a-b-c\r\nprint(a,end=' ') # 结束符：输出后不换行，接一个空格\r\nprint(f\"{a}\") # 格式化输出\r\n```\r\n\r\n## 输入\r\n\r\n快读模板\r\n```python\r\nimport sys\r\ninput=lambda:sys.stdin.readline().strip()\r\n```\r\n\r\n单行多个数据\r\n```python\r\na,b,c=map(int,input().spilt())\r\n# spilt() 按空格分割，int 强制转换成 int 型\r\n```\r\n\r\n多行\r\n```python\r\nn=int(input()) # 强制转换成 int\r\nlst=[int(input()) for _ in range(n)]\r\n# _是占位符\r\n\r\n# 矩阵输入\r\nn,m=map(int,input().spilt())\r\nmatrix=[list(map(int,input().spilt())) for _ in range(n)]\r\n```",
			"published": "2026-09-15",
			"updated": "2026-09-16",
			"history": []
		}
	],
	[
		"notes/python-contest/list-列表",
		{
			"title": "list（列表）",
			"description": "",
			"category": "Python Contest",
			"tags": [
				"学习笔记",
				"Python",
				"算法竞赛"
			],
			"markdown": "## 从某一项的值找它的下标\r\n\r\n.index()\r\n```python\r\nnums = [10, 20, 30]\r\ni = nums.index(20)\r\nprint(i)  # 1\r\n```\r\n- 若有重复值，只返回第一次出现的下标\r\n- 如果值不存在，会报错\r\n\r\n## 二维数组排序\r\n\r\n```python\r\narr.sort(key=lambda x: x[0], reverse=True)\r\n# lambda x:x[0] 表示取第一个元素作为排序依据，reverse=True 表示从大到小\r\n# 这会将数组原地排序\r\n```",
			"published": "2026-09-15",
			"updated": "2026-09-16",
			"history": []
		}
	],
	[
		"notes/python-contest/others",
		{
			"title": "others",
			"description": "",
			"category": "Python Contest",
			"tags": [
				"学习笔记",
				"Python",
				"算法竞赛"
			],
			"markdown": "## lambda 表达式\r\n\r\n即匿名函数\r\n\r\n```python\r\n# lambda 参数:表达式\r\nx=lambda a:a+10 # 让 x 这个函数实现加 10 的效果\r\n```\r\n\r\n## sorted()\r\n\r\n```python\r\n# 返回一个排序后的列表，而不是就地排序\r\nsorted(需要排序的可迭代对象,key=排序规则（一般是一个函数）,reverse=是否需要反向排序（默认升序）)\r\n\r\n# 原地排序\r\nnums.sort()\r\n```\r\n\r\n## 队列\r\n\r\n用双端队列模拟\r\n```python\r\nfrom collections import deque\r\nq=deque()\r\nq.append(x) # 右侧入队\r\n# q.appendleft(x) 左侧入队，但一般不用\r\nx=q.popleft() # 左侧出队\r\n```\r\n\r\n## 栈\r\n\r\n用列表模拟\r\n```python\r\nstk=[]\r\nstk.append(x) # 入栈\r\nx=stk.pop() # 出栈\r\nstk[-1] # 即得到列表的最后一个元素（栈顶）\r\n```\r\n\r\n```python\r\n# 判断空队列/栈\r\nif not q: # q 是空的\r\n\r\n# 栈的翻转\r\nstack[::-1]\r\n\r\n# deque 转换为普通列表\r\nlist(q)\r\n\r\n# 初始化\r\ndeque([1,2,3])\r\n```\r\n\r\n## 字符和 ASCII 码\r\n\r\n```python\r\n# 字符转int\r\nord('a')\r\n# int转字符\r\nchr(97)\r\n```",
			"published": "2026-09-15",
			"updated": "2026-09-16",
			"history": []
		}
	],
	[
		"notes/python-contest/str-字符串",
		{
			"title": "str（字符串）",
			"description": "",
			"category": "Python Contest",
			"tags": [
				"学习笔记",
				"Python",
				"算法竞赛"
			],
			"markdown": "## 判断某个字符是否在串中\r\n\r\n1. in\r\n```python\r\nif 'a' in s:\r\n    # a 在字符串 s 中\r\nif 'a' not in s:\r\n    # a 不在字符串 s 中\r\n```\r\n\r\n2. find\r\n```python\r\ns.find('e')  # 返回位置 1\r\ns.find('x')  # 返回 -1\r\n```\r\n\r\n## 遍历，同时获取下标和字符\r\n\r\n```python\r\nfor i, ch in enumerate(s):\r\n    print(i, ch)\r\n```\r\n\r\n## 常用函数\r\n\r\n- 替换：\r\n```python\r\ns.replace(\"World\", \"Python\")  # 'Hello Python'\r\n```\r\n\r\n- 分割、拼接：\r\n```python\r\ns.split()              # ['Hello', 'World']\r\ns.split(\"o\")           # ['Hell', ' W', 'rld']\r\n\"-\".join([\"a\", \"b\"])   # 'a-b'\r\n```\r\n\r\n- 删除两端空白或指定字符：\r\n```python\r\n\"  hello \\n\".strip()  # 'hello'\r\n\"---hello---\".strip(\"-\")  # 'hello'\r\n\r\n\"  hello\".lstrip()    # 'hello'\r\n\"hello  \".rstrip()    # 'hello'\r\n```\r\n\r\n- 判断字符串类型：\r\n```python\r\n\"123\".isdigit()       # True：全是数字\r\n\"abc\".isalpha()       # True：全是字母\r\n\"abc123\".isalnum()    # True：全是字母或数字\r\n```\r\n\r\n- 前缀、后缀判断：\r\n```python\r\ns.startswith(\"Hello\")  # True\r\ns.endswith(\"World\")    # True\r\n```\r\n\r\n- 字符与 ASCII / Unicode 编码转换：\r\n```python\r\nord('a')  # 97\r\nchr(97)   # 'a'\r\n```\r\n\r\n注意：字符串不可直接修改。\r\n```python\r\ns[0] = 'h'  # 会报错\r\n```\r\n要“修改”字符串，需要生成新字符串：\r\n```python\r\ns = \"h\" + s[1:]  # 'hello World'\r\n```",
			"published": "2026-09-15",
			"updated": "2026-09-16",
			"history": []
		}
	]
]);
export const STATIC_NOTE_SLUGS = new Set(STATIC_NOTES.keys());
export const ARCHIVED_TIMELINE_EVENTS = [
	{
		"id": "archived:notes/hpc/openmp/并行程序设计导论笔记/5-用openmp进行共享内存编程/5-0-导言与5-1-预备知识:2026-09-15",
		"title": "5.0 导言与5.1 预备知识",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/并行程序设计导论笔记/5-用openmp进行共享内存编程/5-10-线程安全性:2026-09-15",
		"title": "5.10 线程安全性",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/并行程序设计导论笔记/5-用openmp进行共享内存编程/5-2-梯形积分法:2026-09-15",
		"title": "5.2 梯形积分法",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/并行程序设计导论笔记/5-用openmp进行共享内存编程/5-3-变量的作用域:2026-09-15",
		"title": "5.3 变量的作用域",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/并行程序设计导论笔记/5-用openmp进行共享内存编程/5-4-归约子句:2026-09-15",
		"title": "5.4 归约子句",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/并行程序设计导论笔记/5-用openmp进行共享内存编程/5-5-parallel-for指令:2026-09-15",
		"title": "5.5 parallel for指令",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/并行程序设计导论笔记/5-用openmp进行共享内存编程/5-6-排序:2026-09-15",
		"title": "5.6 排序",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/并行程序设计导论笔记/5-用openmp进行共享内存编程/5-7-循环调度:2026-09-15",
		"title": "5.7 循环调度",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/并行程序设计导论笔记/5-用openmp进行共享内存编程/5-8-生产者和消费者:2026-09-15",
		"title": "5.8 生产者和消费者",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/并行程序设计导论笔记/5-用openmp进行共享内存编程/5-9-缓存-缓存一致性和伪共享:2026-09-15",
		"title": "5.9 缓存、缓存一致性和伪共享",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/links-并行编程简介/并发与超线程的区别:2026-09-15",
		"title": "并发与超线程的区别",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/并行编程简介:2026-09-15",
		"title": "并行编程简介",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/vtune-profiler/links/常见命令:2026-09-15",
		"title": "常见命令",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"VTune"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/links-并行编程简介/超线程:2026-09-15",
		"title": "超线程",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/web-scraping/简单基本流程:2026-09-15",
		"title": "简单基本流程",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"爬虫"
		],
		"category": "爬虫笔记",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/其他/零碎知识:2026-09-15",
		"title": "零碎知识",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/web-scraping/实例/爬豆瓣-top250-的例子-静态网页:2026-09-15",
		"title": "爬豆瓣 Top250 的例子（静态网页）",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"爬虫"
		],
		"category": "爬虫笔记",
		"available": false
	},
	{
		"id": "archived:notes/web-scraping/实例/使用-playwright-爬取起点中文网月票:2026-09-15",
		"title": "使用 Playwright 爬取起点中文网月票",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"爬虫",
			"Playwright"
		],
		"category": "爬虫笔记",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/links-并行编程简介/线程和进程的区分:2026-09-15",
		"title": "线程和进程的区分",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/nlp/c2-第1节-初级分词技术:2026-09-15",
		"title": "C2 第1节 初级分词技术",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/nlp/c2-第2节-词向量表示:2026-09-15",
		"title": "C2 第2节 词向量表示",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/nlp/c2-第3节-从主题模型到-word2vec:2026-09-15",
		"title": "C2 第3节 从主题模型到 Word2Vec",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理",
			"Word2Vec"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/nlp/c2-第4节-基于-gensim-的词向量实战:2026-09-15",
		"title": "C2 第4节 基于 Gensim 的词向量实战",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理",
			"Gensim"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/nlp/c3-第一节-rnn循环神经网络:2026-09-15",
		"title": "C3 第一节 RNN循环神经网络",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理",
			"RNN"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/lab原文/chapter2-03:2026-09-15",
		"title": "chapter2_03",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/lab原文/chapter2-04:2026-09-15",
		"title": "chapter2_04",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/lab原文/chapter2-05:2026-09-15",
		"title": "chapter2_05",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/lab原文/chapter2-06-gensim:2026-09-15",
		"title": "chapter2_06(Gensim)",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理",
			"Gensim"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/lab原文/chapter3-08-rnn:2026-09-15",
		"title": "chapter3_08(RNN)",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理",
			"RNN"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/natural-language-processing/lab原文/chapter3-09-lstm-gru:2026-09-15",
		"title": "chapter3_09(LSTM&GRU)",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"自然语言处理",
			"LSTM",
			"GRU"
		],
		"category": "自然语言处理学习",
		"available": false
	},
	{
		"id": "archived:notes/hpc/vtune-profiler/get-started:2026-09-15",
		"title": "Get Started",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"VTune"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/links-并行编程简介/numa架构:2026-09-15",
		"title": "NUMA架构",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/openmp基本概念:2026-09-15",
		"title": "OpenMP基本概念",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/web-scraping/playwright:2026-09-15",
		"title": "Playwright",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"爬虫",
			"Playwright"
		],
		"category": "爬虫笔记",
		"available": false
	},
	{
		"id": "archived:notes/web-scraping/re-匹配:2026-09-15",
		"title": "Re 匹配",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"爬虫"
		],
		"category": "爬虫笔记",
		"available": false
	},
	{
		"id": "archived:notes/hpc/openmp/simd-介绍:2026-09-15",
		"title": "SIMD 介绍",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"HPC",
			"OpenMP",
			"SIMD"
		],
		"category": "HPC",
		"available": false
	},
	{
		"id": "archived:notes/web-scraping/url-的基本组成:2026-09-15",
		"title": "URL 的基本组成",
		"date": "2026-09-15",
		"action": "published",
		"tags": [
			"学习笔记",
			"爬虫"
		],
		"category": "爬虫笔记",
		"available": false
	}
];
