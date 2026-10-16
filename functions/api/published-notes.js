import { json } from "../../server/auth.js";

export async function onRequestGet(context) {
	try {
		const result = await context.env.DB.prepare(
			`SELECT slug, title, description, category, tags_json,
			        published_at, updated_at
			 FROM published_notes
			 WHERE status = 'published'
			 ORDER BY published_at DESC, slug ASC`,
		).all();
		const notes = (result.results || []).map((note) => ({
			...note,
			tags: JSON.parse(note.tags_json || "[]"),
			tags_json: undefined,
		}));
		return json({ notes });
	} catch (error) {
		console.error("Published notes lookup failed:", error.message);
		return json({ error: "笔记列表读取失败，请确认数据库迁移已执行。" }, 500);
	}
}
