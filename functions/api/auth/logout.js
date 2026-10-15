import {
	clearSessionCookie,
	json,
	parseCookies,
	recordActivity,
	requestHasSameOrigin,
	SESSION_COOKIE_NAME,
	sha256,
} from "../../../server/auth.js";

export async function onRequestPost(context) {
	const { request, env } = context;
	if (!requestHasSameOrigin(request)) {
		return json({ error: "请求来源无效。" }, 403);
	}

	const token = parseCookies(request).get(SESSION_COOKIE_NAME);
	const userId = context.data?.user?.id || null;
	if (token) {
		try {
			const tokenHash = await sha256(token);
			await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1")
				.bind(tokenHash)
				.run();
		} catch (error) {
			console.error("Logout cleanup failed:", error.message);
		}
	}
	if (userId) {
		await recordActivity(context, {
			userId,
			eventType: "logout",
			path: "/api/auth/logout",
		});
	}

	return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
