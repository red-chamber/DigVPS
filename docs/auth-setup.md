# RC Domain 用户注册系统配置

站点使用 Cloudflare Pages Functions、D1 和 Brevo 邮件 API。只有当 `DB`、`AUTH_SECRET` 和 `BREVO_API_KEY` 都存在时，新登录系统才会启用；否则继续使用原有 HTTP Basic Auth。

## 功能与安全参数

- 任何人都可以使用邮箱注册。
- 注册验证码为六位数字，10 分钟过期，最多尝试 5 次。
- 同一邮箱 60 秒内不能重复发送验证码。
- 同一 IP 每小时最多为 5 个邮箱发起注册。
- 密码使用 PBKDF2-HMAC-SHA256（Cloudflare Workers 允许的上限 100,000 次）加随机盐保存。
- 连续 5 次登录失败后锁定账户 15 分钟。
- 会话有效期固定为 3 天，浏览器 Cookie 使用 `HttpOnly`、`Secure`、`SameSite=Lax`。
- 验证码、会话令牌和注册 IP 均只保存不可逆哈希。

## 1. 配置 Brevo 发件人

1. 创建或登录 Brevo 账户。
2. 在 Brevo 的 **Senders & IP → Senders** 中添加 `autoverification@163.com`。
3. 登录该 163 邮箱，点击 Brevo 发来的验证链接。站点不需要邮箱登录密码或 SMTP 授权码。
4. 在 Brevo 创建一个仅用于本项目的 API Key。

## 2. 创建 D1 数据库

在 Cloudflare 控制台创建名为 `digvps-auth` 的 D1 数据库，然后执行：

```bash
npx wrangler d1 execute digvps-auth --remote --file=migrations/0001_auth.sql
npx wrangler d1 execute digvps-auth --remote --file=migrations/0002_cloudflare_pbkdf2_limit.sql
```

迁移会创建三张表，并创建初始管理员：

- 用户名：`root`
- 邮箱：`autoverification@163.com`
- 初始密码：沿用此前设置的管理员密码

## 3. 配置 Pages 绑定与变量

在 Cloudflare Pages 项目 `digvps` 的 **Settings → Bindings** 中添加：

- D1 binding 名称：`DB`
- D1 数据库：`digvps-auth`

在生产环境变量中添加：

- `AUTH_EMAIL_FROM=autoverification@163.com`
- `AUTH_SECRET`：至少 32 字节的随机字符串，作为加密 Secret 保存
- `BREVO_API_KEY`：Brevo API Key，作为加密 Secret 保存

可用以下 PowerShell 命令生成 `AUTH_SECRET`：

```powershell
$bytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

不要把 `AUTH_SECRET` 或 `BREVO_API_KEY` 写入 Git 仓库。

## 4. 验证

重新部署后检查：

1. 未登录访问首页会跳转到 `/login/`。
2. `/register/` 可以发送验证码。
3. 邮箱验证成功后会自动登录。
4. `/account/` 显示账户和三天后的会话过期时间。
5. 退出后原会话令牌立即失效。
