import { getSession, json } from "../../../server/auth.js";

export async function onRequestGet(context) {
	try {
		const session = await getSession(context);
		if (!session) return json({ error: "尚未登录。" }, 401);
		return json({
			user: session.user,
			expiresAt: session.expiresAt,
		});
	} catch (error) {
		console.error("Session lookup failed:", error.message);
		return json({ error: "会话服务暂时不可用。" }, 500);
	}
}
