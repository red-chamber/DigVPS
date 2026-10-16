import { json } from "../../server/auth.js";
import { validPublishedNoteSlug } from "../../server/notes.js";

export async function onRequestGet(context) {
	const slug = new URL(context.request.url).searchParams.get("slug") || "";
	if (!validPublishedNoteSlug(slug)) {
		return json({ error: "笔记地址无效。" }, 400);
	}
	try {
		const note = await context.env.DB.prepare(
			`SELECT slug, title, description, category, tags_json, rendered_html,
			        published_at, updated_at
			 FROM published_notes
			 WHERE slug = ?1 AND status = 'published'`,
		)
			.bind(slug)
			.first();
		if (!note) return json({ error: "笔记不存在或尚未发布。" }, 404);
		return json({
			note: {
				...note,
				tags: JSON.parse(note.tags_json || "[]"),
				tags_json: undefined,
			},
		});
	} catch (error) {
		console.error("Published note lookup failed:", error.message);
		return json({ error: "笔记读取失败，请稍后重试。" }, 500);
	}
}
