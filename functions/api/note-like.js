import {
	json,
	readJson,
	recordActivity,
	requestHasSameOrigin,
} from "../../server/auth.js";
import { publicNotePath, resolvePublishedNote } from "../../server/notes.js";

export async function onRequestPost(context) {
	if (!requestHasSameOrigin(context.request)) {
		return json({ error: "Invalid request origin." }, 403);
	}
	let body;
	try {
		body = await readJson(context.request);
	} catch (error) {
		return json({ error: error.message || "Invalid request format." }, 400);
	}
	const noteKey = String(body.note || "");
	try {
		const resolved = await resolvePublishedNote(context.env.DB, noteKey);
		if (!resolved) return json({ error: "Only published notes can be liked." }, 404);
		const existing = await context.env.DB.prepare(
			"SELECT 1 AS liked FROM note_likes WHERE note_key = ?1 AND user_id = ?2",
		)
			.bind(noteKey, context.data.user.id)
			.first();
		let liked;
		if (existing) {
			await context.env.DB.prepare(
				"DELETE FROM note_likes WHERE note_key = ?1 AND user_id = ?2",
			)
				.bind(noteKey, context.data.user.id)
				.run();
			liked = false;
		} else {
			await context.env.DB.prepare(
				`INSERT INTO note_likes (note_key, user_id, created_at)
				 VALUES (?1, ?2, ?3)`,
			)
				.bind(noteKey, context.data.user.id, Math.floor(Date.now() / 1000))
				.run();
			liked = true;
			await recordActivity(context, {
				userId: context.data.user.id,
				eventType: "note_liked",
				path: publicNotePath(resolved),
			});
		}
		const count = await context.env.DB.prepare(
			"SELECT COUNT(*) AS count FROM note_likes WHERE note_key = ?1",
		)
			.bind(noteKey)
			.first();
		return json({ liked, likeCount: Number(count?.count || 0) });
	} catch (error) {
		console.error("Note like update failed:", error.message);
		return json({ error: "Failed to update the like. Please try again later." }, 500);
	}
}
