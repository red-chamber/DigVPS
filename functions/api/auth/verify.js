import {
	createSessionRecord,
	json,
	normalizeEmail,
	readJson,
	recordActivity,
	replaceUserSessionStatements,
	requestHasSameOrigin,
	sessionCookie,
	timingSafeEqual,
	validateEmail,
	verificationAttemptLimit,
	verificationCodeHash,
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

	const email = normalizeEmail(body.email);
	const code = String(body.code || "").trim();
	if (!validateEmail(email) || !/^\d{6}$/u.test(code)) {
		return json({ error: "邮箱或验证码格式无效。" }, 400);
	}

	const now = Math.floor(Date.now() / 1000);
	try {
		const record = await env.DB.prepare(
			`SELECT u.id, u.email, u.username, u.role, u.email_verified,
			        v.code_hash, v.expires_at, v.attempts
			 FROM users AS u
			 LEFT JOIN email_verifications AS v ON v.user_id = u.id
			 WHERE u.email = ?1 COLLATE NOCASE`,
		)
			.bind(email)
			.first();

		if (!record || record.email_verified || !record.code_hash) {
			return json({ error: "验证码无效或已经使用。" }, 400);
		}
		if (record.expires_at <= now) {
			await env.DB.prepare("DELETE FROM email_verifications WHERE user_id = ?1")
				.bind(record.id)
				.run();
			return json({ error: "验证码已经过期，请重新获取。" }, 400);
		}
		if (record.attempts >= verificationAttemptLimit()) {
			return json({ error: "验证码尝试次数过多，请重新获取。" }, 429);
		}

		const suppliedHash = await verificationCodeHash(env, record.id, code);
		if (!timingSafeEqual(suppliedHash, record.code_hash)) {
			await env.DB.prepare(
				"UPDATE email_verifications SET attempts = attempts + 1 WHERE user_id = ?1",
			)
				.bind(record.id)
				.run();
			return json({ error: "验证码错误。" }, 400);
		}

		const session = await createSessionRecord(record.id, now);
		await env.DB.batch([
			env.DB.prepare(
				`UPDATE users
				 SET email_verified = 1, verified_at = ?1,
				     failed_login_count = 0, locked_until = NULL
				 WHERE id = ?2`,
			).bind(now, record.id),
			env.DB.prepare("DELETE FROM email_verifications WHERE user_id = ?1").bind(
				record.id,
			),
			...replaceUserSessionStatements(env.DB, session),
		]);
		await recordActivity(context, {
			userId: record.id,
			eventType: "email_verified",
			path: "/api/auth/verify",
		});

		return json(
			{
				ok: true,
				user: { email: record.email, role: record.role },
				expiresAt: session.expiresAt,
			},
			200,
			{ "Set-Cookie": sessionCookie(session.token) },
		);
	} catch (error) {
		console.error("Email verification failed:", error.message);
		return json({ error: "验证服务暂时不可用，请稍后重试。" }, 500);
	}
}
