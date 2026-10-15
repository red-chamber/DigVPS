import { json } from "../../../server/auth.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function positiveInteger(value, fallback) {
	const parsed = Number.parseInt(String(value || ""), 10);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function onRequestGet(context) {
	const currentUser = context.data?.user;
	if (!currentUser) return json({ error: "尚未登录。" }, 401);
	if (currentUser.role !== "admin") {
		return json({ error: "仅管理员可以查看用户活动。" }, 403);
	}

	const url = new URL(context.request.url);
	const limit = Math.min(
		positiveInteger(url.searchParams.get("limit"), DEFAULT_LIMIT),
		MAX_LIMIT,
	);
	const cursor = positiveInteger(url.searchParams.get("cursor"), null);
	const now = Math.floor(Date.now() / 1000);

	try {
		const [usersResult, activitiesResult] = await context.env.DB.batch([
			context.env.DB.prepare(
				`SELECT u.id, u.email, u.username, u.role, u.email_verified,
				        u.created_at, u.verified_at, u.failed_login_count,
				        u.locked_until,
				        (SELECT COUNT(*) FROM sessions AS s
				         WHERE s.user_id = u.id AND s.expires_at > ?1) AS active_sessions,
				        (SELECT MAX(a.created_at) FROM user_activities AS a
				         WHERE a.user_id = u.id) AS last_activity_at
				 FROM users AS u
				 ORDER BY u.created_at DESC, u.id DESC`,
			).bind(now),
			context.env.DB.prepare(
				`SELECT a.id, a.event_type, a.path, a.ip_hash, a.user_agent,
				        a.created_at, a.user_id, u.email, u.username, u.role
				 FROM user_activities AS a
				 LEFT JOIN users AS u ON u.id = a.user_id
				 WHERE (?1 IS NULL OR a.id < ?1)
				 ORDER BY a.id DESC
				 LIMIT ?2`,
			).bind(cursor, limit),
		]);

		const users = usersResult.results || [];
		const activities = (activitiesResult.results || []).map((activity) => ({
			...activity,
			ip_hash: activity.ip_hash ? String(activity.ip_hash).slice(0, 12) : null,
		}));
		const nextCursor =
			activities.length === limit ? activities[activities.length - 1].id : null;

		return json({
			users,
			activities,
			nextCursor,
			summary: {
				totalUsers: users.length,
				verifiedUsers: users.filter((user) => user.email_verified).length,
				activeSessions: users.reduce(
					(total, user) => total + Number(user.active_sessions || 0),
					0,
				),
			},
		});
	} catch (error) {
		console.error("Admin activity lookup failed:", error.message);
		return json({ error: "用户活动读取失败，请确认数据库迁移已执行。" }, 500);
	}
}
