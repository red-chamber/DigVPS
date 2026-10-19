import {
	json,
	randomToken,
	readJson,
	recordActivity,
	requestHasSameOrigin,
} from "../../server/auth.js";
import {
	MAX_NOTE_BYTES,
	MAX_PENDING_NOTE_SUBMISSIONS,
	noteSubmissionInput,
} from "../../server/notes.js";

function requireUser(context) {
	return context.data?.user
		? null
		: json({ error: "You are not signed in." }, 401);
}

export async function onRequestGet(context) {
	const denied = requireUser(context);
	if (denied) return denied;
	try {
		const result = await context.env.DB.prepare(
			`SELECT submission.id, submission.title, submission.description,
			        submission.status, submission.rejection_reason,
			        submission.submitted_at, submission.reviewed_at,
			        note.slug AS published_slug
			 FROM note_submissions AS submission
			 LEFT JOIN published_notes AS note
			   ON note.id = submission.published_note_id
			  AND note.status = 'published'
			 WHERE submission.user_id = ?1
			 ORDER BY submission.submitted_at DESC
			 LIMIT 50`,
		)
			.bind(context.data.user.id)
			.all();
		return json({ submissions: result.results || [] });
	} catch (error) {
		console.error("Note submission lookup failed:", error.message);
		return json({ error: "Failed to load your note submissions." }, 500);
	}
}

export async function onRequestPost(context) {
	const denied = requireUser(context);
	if (denied) return denied;
	if (!requestHasSameOrigin(context.request)) {
		return json({ error: "Invalid request origin." }, 403);
	}
	let body;
	try {
		body = await readJson(context.request, MAX_NOTE_BYTES);
	} catch (error) {
		return json({ error: error.message || "Invalid request body." }, 400);
	}
	const input = noteSubmissionInput(body);
	if (input.error) return json({ error: input.error }, 400);
	const now = Math.floor(Date.now() / 1000);
	try {
		const pending = await context.env.DB.prepare(
			`SELECT COUNT(*) AS total
			 FROM note_submissions
			 WHERE user_id = ?1 AND status = 'pending'`,
		)
			.bind(context.data.user.id)
			.first();
		if (Number(pending?.total || 0) >= MAX_PENDING_NOTE_SUBMISSIONS) {
			return json(
				{
					error: `You may have at most ${MAX_PENDING_NOTE_SUBMISSIONS} notes awaiting review.`,
				},
				429,
			);
		}
		const id = randomToken(18);
		await context.env.DB.prepare(
			`INSERT INTO note_submissions
			 (id, user_id, title, description, markdown, status, submitted_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)`,
		)
			.bind(
				id,
				context.data.user.id,
				input.data.title,
				input.data.description,
				input.data.markdown,
				now,
			)
			.run();
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "note_submitted",
			path: "/account/",
		});
		return json({ ok: true, id, status: "pending", submittedAt: now }, 201);
	} catch (error) {
		console.error("Note submission failed:", error.message);
		return json({ error: "Failed to submit the note. Please try again." }, 500);
	}
}
