import {
	json,
	randomToken,
	readJson,
	recordActivity,
	requestHasSameOrigin,
} from "../../../server/auth.js";
import {
	normalizeSlug,
	publicNotePath,
	renderMarkdown,
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

export async function onRequestGet(context) {
	const denied = requireAdmin(context);
	if (denied) return denied;
	try {
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
	let title;
	let path;
	try {
		if (noteKey.startsWith("dynamic:")) {
			const slug = noteKey.slice("dynamic:".length);
			if (!validPublishedNoteSlug(slug)) {
				return json({ error: "笔记标识无效。" }, 400);
			}
			const note = await context.env.DB.prepare(
				"SELECT title FROM published_notes WHERE slug = ?1 AND status = 'published'",
			)
				.bind(slug)
				.first();
			if (!note) return json({ error: "笔记不存在或已删除。" }, 404);
			await context.env.DB.prepare(
				"UPDATE published_notes SET status = 'archived' WHERE slug = ?1 AND status = 'published'",
			)
				.bind(slug)
				.run();
			title = note.title;
			path = publicNotePath({ type: "dynamic", slug });
		} else if (noteKey.startsWith("static:")) {
			const slug = noteKey.slice("static:".length);
			const metadata = STATIC_NOTES.get(slug);
			if (!metadata) return json({ error: "笔记不存在。" }, 404);
			const result = await context.env.DB.prepare(
				`INSERT INTO deleted_static_notes
				 (note_key, title, category, tags_json, deleted_by, deleted_at)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
				 ON CONFLICT(note_key) DO NOTHING`,
			)
				.bind(
					noteKey,
					metadata.title,
					metadata.category,
					JSON.stringify(metadata.tags),
					context.data.user.id,
					now,
				)
				.run();
			if (result.meta?.changes === 0) {
				return json({ error: "笔记不存在或已删除。" }, 404);
			}
			title = metadata.title;
			path = publicNotePath({ type: "static", slug });
		} else {
			return json({ error: "笔记标识无效。" }, 400);
		}
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "note_deleted",
			path,
		});
		return json({ ok: true, noteKey, title });
	} catch (error) {
		console.error("Note deletion failed:", error.message);
		return json({ error: "笔记删除失败，请稍后重试。" }, 500);
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
		return json({ error: "标题须为 1–120 个字符。" }, 400);
	}
	if (!validPublishedNoteSlug(slug)) {
		return json(
			{ error: "Slug 仅可包含小写字母、数字和连字符，最长 80 个字符。" },
			400,
		);
	}
	if (!description || description.length > 240) {
		return json({ error: "简短介绍须为 1–240 个字符。" }, 400);
	}
	if (!category || category.length > 60) {
		return json({ error: "分类须为 1–60 个字符。" }, 400);
	}
	if (!markdown) return json({ error: "Markdown 正文不能为空。" }, 400);
	if (tags.some((tag) => tag.length > 40)) {
		return json({ error: "每个标签不能超过 40 个字符。" }, 400);
	}

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
				slug,
				title,
				description,
				markdown,
				renderMarkdown(markdown),
				category,
				JSON.stringify(tags),
				context.data.user.id,
				now,
			)
			.run();
		const path = `/notes/read/?slug=${encodeURIComponent(slug)}`;
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "note_published",
			path,
		});
		return json({ ok: true, slug, path }, 201);
	} catch (error) {
		if (/UNIQUE|constraint/iu.test(error.message)) {
			return json({ error: "该 Slug 已经存在，请更换。" }, 409);
		}
		console.error("Note publish failed:", error.message);
		return json({ error: "笔记发布失败，请稍后重试。" }, 500);
	}
}
