import {
	createSessionRecord,
	json,
	loginFailureLimit,
	loginLockSeconds,
	normalizeEmail,
	performDummyPasswordCheck,
	readJson,
	requestHasSameOrigin,
	sessionCookie,
	verifyPassword,
} from "../../../server/auth.js";

export async function onRequestPost(context) {
	const { request, env } = context;
	if (!requestHasSameOrigin(request)) {
		return json({ error: "请求来源无效。" }, 403);
	}

	let body;
	try {
		body = await readJson(request);
	} catch (error) {
		return json({ error: error.message || "请求格式无效。" }, 400);
	}

	const identifier = normalizeEmail(body.email);
	const password = typeof body.password === "string" ? body.password : "";
	if (!identifier || !password) {
		return json({ error: "请输入邮箱和密码。" }, 400);
	}

	const now = Math.floor(Date.now() / 1000);
	try {
		const user = await env.DB.prepare(
			`SELECT id, email, username, password_hash, password_salt,
			        email_verified, role, failed_login_count, locked_until
			 FROM users
			 WHERE email = ?1 COLLATE NOCASE OR username = ?1 COLLATE NOCASE`,
		)
			.bind(identifier)
			.first();

		if (user?.locked_until && user.locked_until > now) {
			return json(
				{
					error: "登录尝试次数过多，请稍后再试。",
					retryAfter: user.locked_until - now,
				},
				429,
			);
		}

		let passwordMatches = false;
		if (user) {
			passwordMatches = await verifyPassword(
				password,
				user.password_hash,
				user.password_salt,
			);
		} else {
			await performDummyPasswordCheck(password);
		}

		if (!user || !passwordMatches) {
			if (user) {
				const previousFailures =
					user.locked_until && user.locked_until <= now
						? 0
						: user.failed_login_count;
				const failures = previousFailures + 1;
				const lockedUntil =
					failures >= loginFailureLimit() ? now + loginLockSeconds() : null;
				await env.DB.prepare(
					`UPDATE users
					 SET failed_login_count = ?1, locked_until = ?2
					 WHERE id = ?3`,
				)
					.bind(failures, lockedUntil, user.id)
					.run();
			}
			return json({ error: "邮箱或密码错误。" }, 401);
		}
		if (!user.email_verified) {
			return json({ error: "请先完成邮箱验证。" }, 403);
		}

		const session = await createSessionRecord(user.id, now);
		await env.DB.batch([
			env.DB.prepare(
				`UPDATE users
				 SET failed_login_count = 0, locked_until = NULL
				 WHERE id = ?1`,
			).bind(user.id),
			env.DB.prepare(
				`INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
				 VALUES (?1, ?2, ?3, ?4)`,
			).bind(
				session.tokenHash,
				session.userId,
				session.createdAt,
				session.expiresAt,
			),
		]);

		return json(
			{
				ok: true,
				user: {
					email: user.email,
					username: user.username,
					role: user.role,
				},
				expiresAt: session.expiresAt,
			},
			200,
			{ "Set-Cookie": sessionCookie(session.token) },
		);
	} catch (error) {
		console.error("Login failed:", error.message);
		return json({ error: "登录服务暂时不可用，请稍后重试。" }, 500);
	}
}
