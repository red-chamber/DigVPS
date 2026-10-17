import { json } from "../../server/auth.js";

export async function onRequestGet(context) {
	try {
		const [result, deletedResult, archivedResult] = await context.env.DB.batch([
			context.env.DB.prepare(
				`SELECT slug, title, description, category, tags_json,
				        published_at, updated_at
				 FROM published_notes
				 WHERE status = 'published'
				 ORDER BY published_at DESC, slug ASC`,
			),
			context.env.DB.prepare(
				"SELECT note_key, title, category, tags_json, deleted_at FROM deleted_static_notes",
			),
			context.env.DB.prepare(
				`SELECT slug, title, category, tags_json, published_at, updated_at
				 FROM published_notes
				 WHERE status = 'archived'
				 ORDER BY published_at DESC, slug ASC`,
			),
		]);
		const notes = (result.results || []).map((note) => ({
			...note,
			tags: JSON.parse(note.tags_json || "[]"),
			tags_json: undefined,
		}));
		const deletedStaticNotes = (deletedResult.results || []).map((note) => ({
			...note,
			tags: JSON.parse(note.tags_json || "[]"),
			tags_json: undefined,
		}));
		const deletedDynamicNotes = (archivedResult.results || []).map((note) => ({
			...note,
			tags: JSON.parse(note.tags_json || "[]"),
			tags_json: undefined,
		}));
		return json({ notes, deletedStaticNotes, deletedDynamicNotes });
	} catch (error) {
		console.error("Published notes lookup failed:", error.message);
		return json({ error: "Failed to load the note list. Confirm that the database migration has been applied." }, 500);
	}
}
