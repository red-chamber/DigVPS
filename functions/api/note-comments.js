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
		return json({ error: "Invalid request origin." }, 403);
	}
	let body;
	try {
		body = await readJson(context.request);
	} catch (error) {
		return json({ error: error.message || "Invalid request format." }, 400);
	}
	const noteKey = String(body.note || "");
	const content = String(body.content || "").trim();
	const length = unicodeLength(content);
	if (length < 1 || length > COMMENT_MAX_CHARACTERS) {
		return json(
			{
				error: `Comments must contain between 1 and ${COMMENT_MAX_CHARACTERS} characters.`,
			},
			400,
		);
	}
	const now = Math.floor(Date.now() / 1000);
	try {
		const resolved = await resolvePublishedNote(context.env.DB, noteKey);
		if (!resolved)
			return json({ error: "Only published notes can receive comments." }, 404);
		const noteTitle = resolved.note.title;
		const authorName =
			context.data.user.username || context.data.user.email || "Deleted User";
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
			return json(
				{
					error:
						"You have already submitted 4 comments in the past 24 hours. Please try again later.",
				},
				429,
			);
		}
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "comment_submitted",
			path: publicNotePath(resolved),
		});
		return json(
			{
				ok: true,
				message:
					"Your comment has been submitted and will appear after administrator approval.",
			},
			201,
		);
	} catch (error) {
		console.error("Comment submission failed:", error.message);
		return json(
			{ error: "Failed to submit the comment. Please try again later." },
			500,
		);
	}
}
