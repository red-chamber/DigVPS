import { json } from "../../server/auth.js";
import { validPublishedNoteSlug } from "../../server/notes.js";

export async function onRequestGet(context) {
	const slug = new URL(context.request.url).searchParams.get("slug") || "";
	if (!validPublishedNoteSlug(slug)) {
		return json({ error: "The note address is invalid." }, 400);
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
		if (!note) return json({ error: "The note does not exist or has not been published." }, 404);
		return json({
			note: {
				...note,
				tags: JSON.parse(note.tags_json || "[]"),
				tags_json: undefined,
			},
		});
	} catch (error) {
		console.error("Published note lookup failed:", error.message);
		return json({ error: "Failed to load the note. Please try again later." }, 500);
	}
}
