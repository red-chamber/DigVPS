import {
	json,
	randomToken,
	readJson,
	recordActivity,
	requestHasSameOrigin,
} from "../../../server/auth.js";
import { MAX_NOTE_BYTES, publishedNoteInput } from "../../../server/notes.js";

function requireAdmin(context) {
	if (!context.data?.user) return json({ error: "尚未登录。" }, 401);
	if (context.data.user.role !== "admin") {
		return json({ error: "仅管理员可以审核笔记投稿。" }, 403);
	}
	return null;
}

export async function onRequestGet(context) {
	const denied = requireAdmin(context);
	if (denied) return denied;
	try {
		const result = await context.env.DB.prepare(
			`SELECT submission.id, submission.title, submission.description,
			        submission.markdown, submission.submitted_at,
			        user.email, user.username
			 FROM note_submissions AS submission
			 JOIN users AS user ON user.id = submission.user_id
			 WHERE submission.status = 'pending'
			 ORDER BY submission.submitted_at ASC`,
		).all();
		return json({ submissions: result.results || [] });
	} catch (error) {
		console.error("Pending note submission lookup failed:", error.message);
		return json({ error: "笔记投稿读取失败，请确认数据库迁移已执行。" }, 500);
	}
}

async function approveSubmission(context, body) {
	const input = publishedNoteInput(body);
	if (input.error) return json({ error: input.error }, 400);
	const note = input.data;
	const now = Math.floor(Date.now() / 1000);
	const noteId = randomToken(18);
	try {
		const [reviewResult] = await context.env.DB.batch([
			context.env.DB.prepare(
				`UPDATE note_submissions
				 SET status = 'approved', rejection_reason = NULL,
				     reviewed_at = ?1, reviewed_by = ?2, published_note_id = ?3
				 WHERE id = ?4 AND status = 'pending'`,
			).bind(now, context.data.user.id, noteId, body.id),
			context.env.DB.prepare(
				`INSERT INTO published_notes
				 (id, slug, title, description, markdown, rendered_html, category,
				  tags_json, author_id, status, published_at, updated_at)
				 SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, submission.user_id,
				        'published', ?9, ?9
				 FROM note_submissions AS submission
				 WHERE submission.id = ?10
				   AND submission.status = 'approved'
				   AND submission.published_note_id = ?1`,
			).bind(
				noteId,
				note.slug,
				note.title,
				note.description,
				note.markdown,
				note.renderedHtml,
				note.category,
				JSON.stringify(note.tags),
				now,
				body.id,
			),
		]);
		if (reviewResult?.meta?.changes === 0) {
			return json({ error: "该投稿不存在或已完成审核。" }, 404);
		}
		const path = `/notes/read/?slug=${encodeURIComponent(note.slug)}`;
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "note_submission_approved",
			path,
		});
		return json({ ok: true, status: "approved", title: note.title, path });
	} catch (error) {
		if (/UNIQUE|constraint/iu.test(error.message)) {
			return json({ error: "该 Slug 已经存在，请更换。" }, 409);
		}
		console.error("Note submission approval failed:", error.message);
		return json({ error: "笔记投稿接纳失败，请稍后重试。" }, 500);
	}
}

async function rejectSubmission(context, body) {
	const reason = String(body.rejectionReason || "").trim();
	if (!reason || reason.length > 500) {
		return json({ error: "驳回理由须为 1–500 个字符。" }, 400);
	}
	const now = Math.floor(Date.now() / 1000);
	try {
		const result = await context.env.DB.prepare(
			`UPDATE note_submissions
			 SET status = 'rejected', rejection_reason = ?1,
			     reviewed_at = ?2, reviewed_by = ?3
			 WHERE id = ?4 AND status = 'pending'`,
		)
			.bind(reason, now, context.data.user.id, body.id)
			.run();
		if (result.meta?.changes === 0) {
			return json({ error: "该投稿不存在或已完成审核。" }, 404);
		}
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "note_submission_rejected",
			path: "/account/",
		});
		return json({ ok: true, status: "rejected" });
	} catch (error) {
		console.error("Note submission rejection failed:", error.message);
		return json({ error: "笔记投稿驳回失败，请稍后重试。" }, 500);
	}
}

export async function onRequestPost(context) {
	const denied = requireAdmin(context);
	if (denied) return denied;
	if (!requestHasSameOrigin(context.request)) {
		return json({ error: "请求来源无效。" }, 403);
	}
	let body;
	try {
		body = await readJson(context.request, MAX_NOTE_BYTES);
	} catch (error) {
		return json({ error: error.message || "请求格式无效。" }, 400);
	}
	const id = String(body.id || "");
	if (!id) return json({ error: "投稿标识无效。" }, 400);
	if (body.action === "approve")
		return approveSubmission(context, { ...body, id });
	if (body.action === "reject")
		return rejectSubmission(context, { ...body, id });
	return json({ error: "审核操作无效。" }, 400);
}
