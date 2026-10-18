import { json } from "../../server/auth.js";

export async function onRequestGet(context) {
	try {
		const [result, archivedResult, updateHistoryResult] =
			await context.env.DB.batch([
				context.env.DB.prepare(
					`SELECT id, slug, title, description, category, tags_json,
				        published_at, updated_at
				 FROM published_notes
				 WHERE status = 'published'
				 ORDER BY published_at DESC, slug ASC`,
				),
				context.env.DB.prepare(
					`SELECT id, slug, title, category, tags_json, published_at, updated_at
				 FROM published_notes
				 WHERE status = 'archived'
				 ORDER BY published_at DESC, slug ASC`,
				),
				context.env.DB.prepare(
					`SELECT event_id, note_id, slug, title, category, tags_json, updated_at
				 FROM note_update_history
				 ORDER BY updated_at ASC, event_id ASC`,
				),
			]);
		const historyByNote = new Map();
		for (const update of updateHistoryResult.results || []) {
			const history = historyByNote.get(update.note_id) || [];
			history.push({
				event_id: update.event_id,
				slug: update.slug,
				title: update.title,
				category: update.category,
				tags: JSON.parse(update.tags_json || "[]"),
				updated_at: update.updated_at,
			});
			historyByNote.set(update.note_id, history);
		}
		const noteSummary = (note) => {
			const { id, tags_json: tagsJson, ...summary } = note;
			return {
				...summary,
				tags: JSON.parse(tagsJson || "[]"),
				updateHistory: historyByNote.get(id) || [],
			};
		};
		const notes = (result.results || []).map(noteSummary);
		const deletedDynamicNotes = (archivedResult.results || []).map(noteSummary);
		return json({ notes, deletedDynamicNotes });
	} catch (error) {
		console.error("Published notes lookup failed:", error.message);
		return json(
			{
				error:
					"Failed to load the note list. Confirm that the database migration has been applied.",
			},
			500,
		);
	}
}
