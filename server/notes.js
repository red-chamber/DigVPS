import katex from "katex";
import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";

export const COMMENT_MAX_CHARACTERS = 500;
export const COMMENT_LIMIT_PER_DAY = 4;
export const COMMENT_WINDOW_SECONDS = 24 * 60 * 60;

const markdown = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: false,
	breaks: false,
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
