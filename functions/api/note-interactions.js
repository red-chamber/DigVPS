import { json } from "../../server/auth.js";
import { resolvePublishedNote } from "../../server/notes.js";

export async function onRequestGet(context) {
	const noteKey = new URL(context.request.url).searchParams.get("note") || "";
	try {
		const resolved = await resolvePublishedNote(context.env.DB, noteKey);
		if (!resolved) return json({ error: "只能查看已发布笔记的互动。" }, 404);

		const [likes, liked, comments] = await context.env.DB.batch([
			context.env.DB.prepare(
				"SELECT COUNT(*) AS count FROM note_likes WHERE note_key = ?1",
			).bind(noteKey),
			context.env.DB.prepare(
				"SELECT 1 AS liked FROM note_likes WHERE note_key = ?1 AND user_id = ?2",
			).bind(noteKey, context.data.user.id),
			context.env.DB.prepare(
				`SELECT id, author_name, content, created_at
				 FROM note_comments
				 WHERE note_key = ?1 AND status = 'approved'
				 ORDER BY created_at ASC, id ASC`,
			).bind(noteKey),
		]);
		return json({
			likeCount: Number(likes.results?.[0]?.count || 0),
			liked: Boolean(liked.results?.length),
			comments: comments.results || [],
		});
	} catch (error) {
		console.error("Note interactions lookup failed:", error.message);
		return json({ error: "互动信息读取失败，请稍后重试。" }, 500);
	}
}
