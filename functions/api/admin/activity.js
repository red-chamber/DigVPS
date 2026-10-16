import { json } from "../../../server/auth.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const IMPORTANT_EVENTS_SQL = `
	'registration_requested',
	'email_verified',
	'login_success',
	'logout',
	'comment_submitted',
	'comment_approved',
	'comment_rejected',
	'note_published',
	'note_deleted',
	'note_liked',
	'account_deleted'
`;

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
	try {
		const [usersResult, activitiesResult] = await context.env.DB.batch([
			context.env.DB.prepare(
				`SELECT u.id, u.email, u.username, u.role, u.email_verified,
				        u.created_at, u.verified_at, u.failed_login_count,
				        u.locked_until,
			        (SELECT MAX(a.created_at) FROM user_activities AS a
			         WHERE a.user_id = u.id
			           AND a.event_type IN (${IMPORTANT_EVENTS_SQL})) AS last_activity_at
				 FROM users AS u
				 ORDER BY u.created_at DESC, u.id DESC`,
			),
			context.env.DB.prepare(
				`SELECT a.id, a.event_type, a.path, a.ip_hash, a.user_agent,
				        a.created_at, a.user_id, u.email, u.username, u.role
				 FROM user_activities AS a
				 LEFT JOIN users AS u ON u.id = a.user_id
				 WHERE a.event_type IN (${IMPORTANT_EVENTS_SQL})
				   AND (?1 IS NULL OR a.id < ?1)
				 ORDER BY a.id DESC
				 LIMIT ?2`,
			).bind(cursor, limit + 1),
		]);

		const users = usersResult.results || [];
		const activityRows = activitiesResult.results || [];
		const hasMore = activityRows.length > limit;
		const activities = activityRows.slice(0, limit).map((activity) => ({
			...activity,
			ip_hash: activity.ip_hash ? String(activity.ip_hash).slice(0, 12) : null,
		}));
		const nextCursor =
			hasMore && activities.length
				? activities[activities.length - 1].id
				: null;

		return json({
			users,
			activities,
			nextCursor,
			summary: {
				totalUsers: users.length,
				verifiedUsers: users.filter((user) => user.email_verified).length,
			},
		});
	} catch (error) {
		console.error("Admin activity lookup failed:", error.message);
		return json({ error: "用户活动读取失败，请确认数据库迁移已执行。" }, 500);
	}
}
