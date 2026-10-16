import {
	json,
	randomToken,
	readJson,
	recordActivity,
	requestHasSameOrigin,
} from "../../../server/auth.js";
import {
	normalizeSlug,
	renderMarkdown,
	validPublishedNoteSlug,
} from "../../../server/notes.js";

const MAX_NOTE_BYTES = 256 * 1024;

export async function onRequestPost(context) {
	if (context.data?.user?.role !== "admin") {
		return json({ error: "仅管理员可以发布笔记。" }, 403);
	}
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
