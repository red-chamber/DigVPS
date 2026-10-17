import {
	json,
	randomToken,
	readJson,
	recordActivity,
	requestHasSameOrigin,
} from "../../../server/auth.js";
import {
	normalizeSlug,
	prepareNoteDeletion,
	renderMarkdown,
	resolvePublishedNote,
	validPublishedNoteSlug,
} from "../../../server/notes.js";
import { STATIC_NOTES } from "../../../server/static-notes.js";

const MAX_NOTE_BYTES = 256 * 1024;

function requireAdmin(context) {
	if (!context.data?.user) return json({ error: "尚未登录。" }, 401);
	if (context.data.user.role !== "admin") {
		return json({ error: "仅管理员可以管理笔记。" }, 403);
	}
	return null;
}

function parseTags(value) {
	try {
		const tags = JSON.parse(value || "[]");
		return Array.isArray(tags) ? tags.map(String) : [];
	} catch {
		return [];
	}
}

function noteInput(body) {
	const title = String(body.title || "").trim();
	const slug = normalizeSlug(body.slug);
	const description = String(body.description || "").trim();
	const category = String(body.category || "").trim();
	const markdown = String(body.markdown || "").trim();
	const tags = Array.isArray(body.tags)
		? [
				...new Set(body.tags.map((tag) => String(tag).trim()).filter(Boolean)),
			].slice(0, 12)
		: [];
	if (!title || title.length > 120) {
		return { error: "标题须为 1–120 个字符。" };
	}
	if (!validPublishedNoteSlug(slug)) {
		return {
			error: "Slug 仅可包含小写字母、数字和连字符，最长 80 个字符。",
		};
	}
	if (!description || description.length > 240) {
		return { error: "简短介绍须为 1–240 个字符。" };
	}
	if (!category || category.length > 60) {
		return { error: "分类须为 1–60 个字符。" };
	}
	if (!markdown) return { error: "Markdown 正文不能为空。" };
	if (tags.some((tag) => tag.length > 40)) {
		return { error: "每个标签不能超过 40 个字符。" };
	}
	return {
		data: {
			title,
			slug,
			description,
			category,
			markdown,
			tags,
			renderedHtml: renderMarkdown(markdown),
		},
	};
}

function dateSeconds(value, fallback) {
	const milliseconds = new Date(value).getTime();
	return Number.isFinite(milliseconds)
		? Math.floor(milliseconds / 1000)
		: fallback;
}

function staticTimelineCandidates(slug, metadata) {
	const candidates = [
		{ date: metadata.published, action: "published" },
		...(metadata.history || []),
	];
	if (metadata.updated && metadata.updated !== metadata.published) {
		candidates.push({ date: metadata.updated, action: "updated" });
	}
	const seen = new Set();
	return candidates
		.filter((event) => event.date)
		.map((event) => ({
			...event,
			iso: new Date(event.date).toISOString(),
		}))
		.filter((event) => {
			const key = `${event.action}:${event.iso}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.map((event) => ({
			...event,
			id: `${slug}:${event.action}:${event.iso}`,
			dateSeconds: dateSeconds(event.iso, 0),
		}));
}

async function editableNote(db, noteKey) {
	if (noteKey.startsWith("static:")) {
		const resolved = await resolvePublishedNote(db, noteKey);
		if (!resolved || resolved.type !== "static") return null;
		return {
			key: resolved.key,
			type: "static",
			slug: resolved.slug,
			title: resolved.metadata.title,
			description: resolved.metadata.description,
			category: resolved.metadata.category,
			tags: resolved.metadata.tags,
			markdown: resolved.metadata.markdown || "",
			metadata: resolved.metadata,
		};
	}
	if (!noteKey.startsWith("dynamic:")) return null;
	const slug = noteKey.slice("dynamic:".length);
	if (!validPublishedNoteSlug(slug)) return null;
	const note = await db
		.prepare(
			`SELECT id, slug, title, description, markdown, category, tags_json,
			        published_at, updated_at
			 FROM published_notes
			 WHERE slug = ?1 AND status = 'published'`,
		)
		.bind(slug)
		.first();
	return note
		? {
				...note,
				key: noteKey,
				type: "dynamic",
				tags: parseTags(note.tags_json),
			}
		: null;
}

export async function onRequestGet(context) {
	const denied = requireAdmin(context);
	if (denied) return denied;
	try {
		const noteKey = new URL(context.request.url).searchParams.get("noteKey");
		if (noteKey) {
			const note = await editableNote(context.env.DB, noteKey);
			if (!note) return json({ error: "笔记不存在或已删除。" }, 404);
			return json({
				note: {
					key: note.key,
					type: note.type,
					title: note.title,
					slug: note.slug,
					description: note.description,
					category: note.category,
					tags: note.tags,
					markdown: note.markdown,
				},
			});
		}
		const [dynamicResult, deletedResult] = await context.env.DB.batch([
			context.env.DB.prepare(
				`SELECT slug, title, description, category, tags_json, published_at
				 FROM published_notes
				 WHERE status = 'published'
				 ORDER BY published_at DESC, slug ASC`,
			),
			context.env.DB.prepare("SELECT note_key FROM deleted_static_notes"),
		]);
		const deleted = new Set(
			(deletedResult.results || []).map((row) => row.note_key),
		);
		const staticNotes = Array.from(STATIC_NOTES, ([slug, metadata]) => ({
			key: `static:${slug}`,
			type: "static",
			title: metadata.title,
			description: metadata.description,
			category: metadata.category,
			tags: metadata.tags,
			publishedAt: null,
			path: `/posts/${slug}/`,
		})).filter((note) => !deleted.has(note.key));
		const dynamicNotes = (dynamicResult.results || []).map((note) => ({
			key: `dynamic:${note.slug}`,
			type: "dynamic",
			title: note.title,
			description: note.description,
			category: note.category,
			tags: parseTags(note.tags_json),
			publishedAt: note.published_at,
			path: `/notes/read/?slug=${encodeURIComponent(note.slug)}`,
		}));
		return json({ notes: [...dynamicNotes, ...staticNotes] });
	} catch (error) {
		console.error("Admin notes lookup failed:", error.message);
		return json({ error: "笔记列表读取失败，请确认数据库迁移已执行。" }, 500);
	}
}

export async function onRequestDelete(context) {
	const denied = requireAdmin(context);
	if (denied) return denied;
	if (!requestHasSameOrigin(context.request)) {
		return json({ error: "请求来源无效。" }, 403);
	}
	let body;
	try {
		body = await readJson(context.request, 8 * 1024);
	} catch (error) {
		return json({ error: error.message || "请求格式无效。" }, 400);
	}
	const noteKey = String(body.noteKey || "");
	const now = Math.floor(Date.now() / 1000);
	try {
		if (noteKey.startsWith("dynamic:")) {
			const slug = noteKey.slice("dynamic:".length);
			if (!validPublishedNoteSlug(slug)) {
				return json({ error: "笔记标识无效。" }, 400);
			}
		} else if (!noteKey.startsWith("static:")) {
			return json({ error: "笔记标识无效。" }, 400);
		}
		const resolved = await resolvePublishedNote(context.env.DB, noteKey);
		if (!resolved) return json({ error: "笔记不存在或已删除。" }, 404);
		const deletion = prepareNoteDeletion(
			context.env.DB,
			resolved,
			context.data.user.id,
			now,
		);
		const result = await deletion.statement.run();
		if (result.meta?.changes === 0) {
			return json({ error: "笔记不存在或已删除。" }, 404);
		}
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "note_deleted",
			path: deletion.path,
		});
		return json({ ok: true, noteKey, title: deletion.title });
	} catch (error) {
		console.error("Note deletion failed:", error.message);
		return json({ error: "笔记删除失败，请稍后重试。" }, 500);
	}
}

export async function onRequestPut(context) {
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
	const noteKey = String(body.noteKey || "");
	const input = noteInput(body);
	if (input.error) return json({ error: input.error }, 400);
	const note = input.data;
	const now = Math.floor(Date.now() / 1000);
	const eventId = `dynamic-update:${randomToken(18)}`;

	try {
		const current = await editableNote(context.env.DB, noteKey);
		if (!current) return json({ error: "笔记不存在或已删除。" }, 404);
		const newNoteKey = `dynamic:${note.slug}`;
		let updateResult;

		if (current.type === "dynamic") {
			const statements = [
				context.env.DB.prepare(
					`UPDATE published_notes
					 SET slug = ?1, title = ?2, description = ?3, markdown = ?4,
					     rendered_html = ?5, category = ?6, tags_json = ?7,
					     updated_at = ?8
					 WHERE id = ?9 AND status = 'published'`,
				).bind(
					note.slug,
					note.title,
					note.description,
					note.markdown,
					note.renderedHtml,
					note.category,
					JSON.stringify(note.tags),
					now,
					current.id,
				),
				context.env.DB.prepare(
					`UPDATE note_comments
					 SET note_key = ?1, note_title = ?2
					 WHERE note_key = ?3`,
				).bind(newNoteKey, note.title, current.key),
				context.env.DB.prepare(
					"UPDATE note_likes SET note_key = ?1 WHERE note_key = ?2",
				).bind(newNoteKey, current.key),
				context.env.DB.prepare(
					`INSERT INTO note_update_history
					 (event_id, note_id, slug, title, category, tags_json, updated_at)
					 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
				).bind(
					eventId,
					current.id,
					note.slug,
					note.title,
					note.category,
					JSON.stringify(note.tags),
					now,
				),
			];
			[updateResult] = await context.env.DB.batch(statements);
		} else {
			const noteId = randomToken(18);
			const publishedAt = dateSeconds(current.metadata.published, now);
			const sourceEvents = staticTimelineCandidates(
				current.slug,
				current.metadata,
			);
			const statements = [
				context.env.DB.prepare(
					`INSERT INTO published_notes
					 (id, slug, title, description, markdown, rendered_html, category,
					  tags_json, author_id, status, published_at, updated_at)
					 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'published', ?10, ?11)`,
				).bind(
					noteId,
					note.slug,
					note.title,
					note.description,
					note.markdown,
					note.renderedHtml,
					note.category,
					JSON.stringify(note.tags),
					context.data.user.id,
					publishedAt,
					now,
				),
				context.env.DB.prepare(
					`INSERT INTO deleted_static_notes
					 (note_key, title, category, tags_json, deleted_by, deleted_at)
					 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
					 ON CONFLICT(note_key) DO NOTHING`,
				).bind(
					current.key,
					current.title,
					current.category,
					JSON.stringify(current.tags),
					context.data.user.id,
					now,
				),
				context.env.DB.prepare(
					`UPDATE note_comments
					 SET note_key = ?1, note_title = ?2
					 WHERE note_key = ?3`,
				).bind(newNoteKey, note.title, current.key),
				context.env.DB.prepare(
					"UPDATE note_likes SET note_key = ?1 WHERE note_key = ?2",
				).bind(newNoteKey, current.key),
			];
			for (const [index, sourceEvent] of sourceEvents.entries()) {
				statements.push(
					context.env.DB.prepare(
						`INSERT OR IGNORE INTO hidden_timeline_events
						 (event_id, deleted_by, deleted_at) VALUES (?1, ?2, ?3)`,
					).bind(sourceEvent.id, context.data.user.id, now),
				);
				if (sourceEvent.action === "updated") {
					statements.push(
						context.env.DB.prepare(
							`INSERT INTO note_update_history
							 (event_id, note_id, slug, title, category, tags_json, updated_at)
							 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
						).bind(
							`converted-static:${noteId}:${index}`,
							noteId,
							note.slug,
							current.title,
							current.category,
							JSON.stringify(current.tags),
							sourceEvent.dateSeconds,
						),
					);
				}
			}
			statements.push(
				context.env.DB.prepare(
					`INSERT INTO note_update_history
					 (event_id, note_id, slug, title, category, tags_json, updated_at)
					 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
				).bind(
					eventId,
					noteId,
					note.slug,
					note.title,
					note.category,
					JSON.stringify(note.tags),
					now,
				),
			);
			[updateResult] = await context.env.DB.batch(statements);
		}

		if (updateResult?.meta?.changes === 0) {
			return json({ error: "笔记不存在或已删除。" }, 404);
		}
		const path = `/notes/read/?slug=${encodeURIComponent(note.slug)}`;
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "note_updated",
			path,
		});
		return json({
			ok: true,
			noteKey: newNoteKey,
			slug: note.slug,
			title: note.title,
			path,
			eventId,
		});
	} catch (error) {
		if (/UNIQUE|constraint/iu.test(error.message)) {
			return json({ error: "该 Slug 已经存在，请更换。" }, 409);
		}
		console.error("Note update failed:", error.message);
		return json({ error: "笔记更新失败，请稍后重试。" }, 500);
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
	const input = noteInput(body);
	if (input.error) return json({ error: input.error }, 400);
	const note = input.data;

	const now = Math.floor(Date.now() / 1000);
	try {
		await context.env.DB.prepare(
			`INSERT INTO published_notes
			 (id, slug, title, description, markdown, rendered_html, category,
			  tags_json, author_id, status, published_at, updated_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'published', ?10, ?10)`,
		)
			.bind(
				randomToken(18),
				note.slug,
				note.title,
				note.description,
				note.markdown,
				note.renderedHtml,
				note.category,
				JSON.stringify(note.tags),
				context.data.user.id,
				now,
			)
			.run();
		const path = `/notes/read/?slug=${encodeURIComponent(note.slug)}`;
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "note_published",
			path,
		});
		return json({ ok: true, slug: note.slug, path }, 201);
	} catch (error) {
		if (/UNIQUE|constraint/iu.test(error.message)) {
			return json({ error: "该 Slug 已经存在，请更换。" }, 409);
		}
		console.error("Note publish failed:", error.message);
		return json({ error: "笔记发布失败，请稍后重试。" }, 500);
	}
}
