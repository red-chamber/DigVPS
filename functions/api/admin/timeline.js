import {
	json,
	randomToken,
	readJson,
	recordActivity,
	requestHasSameOrigin,
} from "../../../server/auth.js";
import { loadTimelineData } from "../../../server/timeline.js";

function requireAdmin(context) {
	if (!context.data?.user) return json({ error: "尚未登录。" }, 401);
	if (context.data.user.role !== "admin") {
		return json({ error: "仅管理员可以管理公开时间线。" }, 403);
	}
	return null;
}

export async function onRequestGet(context) {
	const denied = requireAdmin(context);
	if (denied) return denied;
	try {
		const { events } = await loadTimelineData(context.env.DB);
		return json({ events });
	} catch (error) {
		console.error("Admin timeline lookup failed:", error.message);
		return json({ error: "公开时间线读取失败，请确认数据库迁移已执行。" }, 500);
	}
}

export async function onRequestPost(context) {
	const denied = requireAdmin(context);
	if (denied) return denied;
	if (!requestHasSameOrigin(context.request)) {
		return json({ error: "请求来源无效。" }, 403);
	}
	let body;
	try {
		body = await readJson(context.request, 8 * 1024);
	} catch (error) {
		return json({ error: error.message || "请求格式无效。" }, 400);
	}
	const title = String(body.title || "").trim();
	if (!title || title.length > 160) {
		return json({ error: "活动内容须为 1–160 个字符。" }, 400);
	}
	const id = `custom:${randomToken(18)}`;
	const createdAt = Math.floor(Date.now() / 1000);
	try {
		await context.env.DB.prepare(
			`INSERT INTO public_timeline_events
			 (id, title, created_by, created_at, status)
			 VALUES (?1, ?2, ?3, ?4, 'published')`,
		)
			.bind(id, title, context.data.user.id, createdAt)
			.run();
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "timeline_event_published",
			path: "/archive/",
		});
		return json({ ok: true, event: { id, title, createdAt } }, 201);
	} catch (error) {
		console.error("Timeline event publish failed:", error.message);
		return json({ error: "公开活动发布失败，请稍后重试。" }, 500);
	}
}

export async function onRequestDelete(context) {
	const denied = requireAdmin(context);
	if (denied) return denied;
	if (!requestHasSameOrigin(context.request)) {
		return json({ error: "请求来源无效。" }, 403);
	}
	let body;
	try {
		body = await readJson(context.request, 8 * 1024);
	} catch (error) {
		return json({ error: error.message || "请求格式无效。" }, 400);
	}
	const eventId = String(body.eventId || "");
	if (!eventId || eventId.length > 500) {
		return json({ error: "时间线活动标识无效。" }, 400);
	}
	try {
		const { events } = await loadTimelineData(context.env.DB);
		if (!events.some((event) => event.id === eventId)) {
			return json({ error: "时间线活动不存在或已删除。" }, 404);
		}
		const now = Math.floor(Date.now() / 1000);
		if (eventId.startsWith("custom:")) {
			await context.env.DB.prepare(
				`UPDATE public_timeline_events
				 SET status = 'deleted'
				 WHERE id = ?1 AND status = 'published'`,
			)
				.bind(eventId)
				.run();
		} else {
			await context.env.DB.prepare(
				`INSERT INTO hidden_timeline_events (event_id, deleted_by, deleted_at)
				 VALUES (?1, ?2, ?3)`,
			)
				.bind(eventId, context.data.user.id, now)
				.run();
		}
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "timeline_event_deleted",
			path: "/archive/",
		});
		return json({ ok: true, eventId });
	} catch (error) {
		console.error("Timeline event deletion failed:", error.message);
		return json({ error: "时间线活动删除失败，请稍后重试。" }, 500);
	}
}
