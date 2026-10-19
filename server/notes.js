import highlight from "highlight.js/lib/core";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import python from "highlight.js/lib/languages/python";
import katex from "katex";
import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";

export const COMMENT_MAX_CHARACTERS = 500;
export const COMMENT_LIMIT_PER_DAY = 4;
export const COMMENT_WINDOW_SECONDS = 24 * 60 * 60;
export const MAX_NOTE_BYTES = 256 * 1024;
export const MAX_PENDING_NOTE_SUBMISSIONS = 5;

highlight.registerLanguage("python", python);
highlight.registerLanguage("c", c);
highlight.registerLanguage("cpp", cpp);

function highlightCode(source, language) {
	const name = String(language || "")
		.trim()
		.toLowerCase();
	if (!highlight.getLanguage(name)) return "";
	return highlight.highlight(source, { language: name }).value;
}

const markdown = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: false,
	breaks: false,
	highlight: highlightCode,
}).use(texmath, {
	engine: katex,
	delimiters: "dollars",
	katexOptions: {
		throwOnError: false,
		trust: false,
	},
});

export function renderMarkdown(source) {
	return markdown.render(String(source || ""));
}

export function unicodeLength(value) {
	return Array.from(String(value || "")).length;
}

export function normalizeSlug(value) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/\s+/gu, "-");
}

export function validPublishedNoteSlug(value) {
	return /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/u.test(value);
}

export function publishedNoteInput(body) {
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

export function noteSubmissionInput(body) {
	const title = String(body.title || "").trim();
	const description = String(body.description || "").trim();
	const markdown = String(body.markdown || "").trim();
	if (!title || title.length > 120) {
		return { error: "The title must contain 1–120 characters." };
	}
	if (!description || description.length > 240) {
		return { error: "The introduction must contain 1–240 characters." };
	}
	if (!markdown) return { error: "The Markdown body cannot be empty." };
	return { data: { title, description, markdown } };
}

export async function resolvePublishedNote(db, noteKey) {
	const key = String(noteKey || "");
	if (!key.startsWith("dynamic:")) return null;
	const slug = key.slice("dynamic:".length);
	if (!validPublishedNoteSlug(slug)) return null;
	const note = await db
		.prepare(
			`SELECT slug, title, description, category, tags_json, rendered_html,
			        published_at, updated_at
			 FROM published_notes
			 WHERE slug = ?1 AND status = 'published'`,
		)
		.bind(slug)
		.first();
	return note ? { key, slug, note } : null;
}

export function publicNotePath(resolved) {
	return `/notes/read/?slug=${encodeURIComponent(resolved.slug)}`;
}

export function prepareNoteDeletion(db, resolved) {
	const statement = db
		.prepare(
			"UPDATE published_notes SET status = 'archived' WHERE slug = ?1 AND status = 'published'",
		)
		.bind(resolved.slug);
	return {
		statement,
		title: resolved.note.title,
		path: publicNotePath(resolved),
	};
}
