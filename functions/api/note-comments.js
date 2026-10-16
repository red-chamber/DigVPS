import {
	json,
	randomToken,
	readJson,
	recordActivity,
	requestHasSameOrigin,
} from "../../server/auth.js";
import {
	COMMENT_LIMIT_PER_DAY,
	COMMENT_MAX_CHARACTERS,
	COMMENT_WINDOW_SECONDS,
	publicNotePath,
	resolvePublishedNote,
	unicodeLength,
} from "../../server/notes.js";

export async function onRequestPost(context) {
	if (!requestHasSameOrigin(context.request)) {
		return json({ error: "请求来源无效。" }, 403);
	}
	let body;
	try {
		body = await readJson(context.request);
	} catch (error) {
		return json({ error: error.message || "请求格式无效。" }, 400);
	}
	const noteKey = String(body.note || "");
	const content = String(body.content || "").trim();
	const length = unicodeLength(content);
	if (length < 1 || length > COMMENT_MAX_CHARACTERS) {
		return json(
			{ error: `评论须为 1–${COMMENT_MAX_CHARACTERS} 个字符。` },
			400,
		);
	}
	const now = Math.floor(Date.now() / 1000);
	try {
		const resolved = await resolvePublishedNote(context.env.DB, noteKey);
		if (!resolved) return json({ error: "只能评论已发布的笔记。" }, 404);
		const noteTitle =
			resolved.type === "dynamic" ? resolved.note.title : resolved.title;
		const authorName =
			context.data.user.username || context.data.user.email || "已注销用户";
		const result = await context.env.DB.prepare(
			`INSERT INTO note_comments
			 (id, note_key, note_title, user_id, author_name, content, status, created_at)
			 SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7
			 WHERE (SELECT COUNT(*) FROM note_comments
			        WHERE user_id = ?4 AND created_at >= ?8) < ?9`,
		)
			.bind(
				randomToken(18),
				noteKey,
				noteTitle,
				context.data.user.id,
				authorName,
				content,
				now,
				now - COMMENT_WINDOW_SECONDS,
				COMMENT_LIMIT_PER_DAY,
			)
			.run();
		if (!Number(result.meta?.changes || 0)) {
			return json({ error: "过去 24 小时已提交 4 条评论，请稍后再试。" }, 429);
		}
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "comment_submitted",
			path: publicNotePath(resolved),
		});
		return json(
			{ ok: true, message: "评论已提交，管理员审核通过后会显示。" },
			201,
		);
	} catch (error) {
		console.error("Comment submission failed:", error.message);
		return json({ error: "评论提交失败，请稍后重试。" }, 500);
	}
}
