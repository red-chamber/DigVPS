import {
	json,
	readJson,
	recordActivity,
	requestHasSameOrigin,
} from "../../../server/auth.js";
import { publicNotePath, resolvePublishedNote } from "../../../server/notes.js";

function requireAdmin(context) {
	return context.data?.user?.role === "admin";
}

export async function onRequestGet(context) {
	if (!requireAdmin(context))
		return json({ error: "仅管理员可以审核评论。" }, 403);
	try {
		const result = await context.env.DB.prepare(
			`SELECT c.id, c.note_key, c.note_title, c.author_name, c.content,
			        c.created_at, u.email
			 FROM note_comments AS c
			 LEFT JOIN users AS u ON u.id = c.user_id
			 WHERE c.status = 'pending'
			 ORDER BY c.created_at ASC, c.id ASC
			 LIMIT 100`,
		).all();
		return json({ comments: result.results || [] });
	} catch (error) {
		console.error("Pending comments lookup failed:", error.message);
		return json({ error: "待审核评论读取失败，请确认数据库迁移已执行。" }, 500);
	}
}

export async function onRequestPost(context) {
	if (!requireAdmin(context))
		return json({ error: "仅管理员可以审核评论。" }, 403);
	if (!requestHasSameOrigin(context.request)) {
		return json({ error: "请求来源无效。" }, 403);
	}
	let body;
	try {
		body = await readJson(context.request);
	} catch (error) {
		return json({ error: error.message || "请求格式无效。" }, 400);
	}
	const id = String(body.id || "");
	const action =
		body.action === "approve"
			? "approved"
			: body.action === "reject"
				? "rejected"
				: "";
	if (!id || !action) return json({ error: "审核操作无效。" }, 400);

	try {
		const comment = await context.env.DB.prepare(
			"SELECT id, note_key, status FROM note_comments WHERE id = ?1",
		)
			.bind(id)
			.first();
		if (!comment) return json({ error: "评论不存在。" }, 404);
		if (comment.status !== "pending")
			return json({ error: "该评论已经审核。" }, 409);
		const result = await context.env.DB.prepare(
			`UPDATE note_comments
			 SET status = ?1, moderated_at = ?2, moderated_by = ?3
			 WHERE id = ?4 AND status = 'pending'`,
		)
			.bind(action, Math.floor(Date.now() / 1000), context.data.user.id, id)
			.run();
		if (!Number(result.meta?.changes || 0)) {
			return json({ error: "该评论已经被其他管理员处理。" }, 409);
		}
		const resolved = await resolvePublishedNote(
			context.env.DB,
			comment.note_key,
		);
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType:
				action === "approved" ? "comment_approved" : "comment_rejected",
			path: resolved ? publicNotePath(resolved) : null,
		});
		return json({ ok: true, status: action });
	} catch (error) {
		console.error("Comment moderation failed:", error.message);
		return json({ error: "评论审核失败，请稍后重试。" }, 500);
	}
}
