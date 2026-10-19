import { initNoteInteractions } from "./note-interactions";
import {
	getPublishedNotes,
	type PublishedNoteSummary,
} from "./published-notes";

const loadingNotes = new WeakSet<HTMLElement>();

function codeLanguage(code: HTMLElement) {
	const languageClass = Array.from(code.classList).find((name) =>
		name.startsWith("language-"),
	);
	return languageClass
		? languageClass.slice("language-".length).replaceAll("-", " ")
		: "code";
}

async function copyCode(source: string) {
	if (!navigator.clipboard?.writeText) {
		throw new Error("Clipboard access is unavailable.");
	}
	await navigator.clipboard.writeText(source);
}

function enhanceCodeBlocks(content: HTMLElement) {
	for (const pre of content.querySelectorAll<HTMLPreElement>("pre")) {
		if (pre.dataset.enhanced === "true") continue;
		const code = pre.querySelector<HTMLElement>(":scope > code");
		if (!code) continue;
		pre.dataset.enhanced = "true";

		const frame = document.createElement("div");
		frame.className = "dynamic-code-block";
		const toolbar = document.createElement("div");
		toolbar.className = "dynamic-code-toolbar";
		const language = document.createElement("span");
		language.className = "dynamic-code-language";
		language.textContent = codeLanguage(code);
		const copy = document.createElement("button");
		copy.type = "button";
		copy.className = "dynamic-code-copy";
		copy.textContent = "Copy";
		copy.setAttribute("aria-label", "Copy code");
		copy.addEventListener("click", async () => {
			copy.disabled = true;
			try {
				await copyCode(code.textContent || "");
				copy.textContent = "Copied";
				copy.classList.add("success");
				window.setTimeout(() => {
					copy.textContent = "Copy";
					copy.classList.remove("success");
				}, 1200);
			} catch {
				copy.textContent = "Failed";
				window.setTimeout(() => {
					copy.textContent = "Copy";
				}, 1200);
			} finally {
				copy.disabled = false;
			}
		});

		pre.before(frame);
		toolbar.append(language, copy);
		frame.append(toolbar, pre);
	}
}

function enhanceMathBlocks(content: HTMLElement) {
	for (const formula of content.querySelectorAll<HTMLElement>(
		".katex-display",
	)) {
		if (formula.parentElement?.classList.contains("katex-display-container")) {
			continue;
		}
		const container = document.createElement("div");
		container.className = "katex-display-container";
		container.setAttribute("aria-label", "Scrollable mathematical formula");
		formula.before(container);
		container.append(formula);
	}
}

function relatedNoteScore(
	current: { category: string; tags?: string[] },
	candidate: PublishedNoteSummary,
) {
	let score = candidate.category === current.category ? 3 : 0;
	const currentTags = new Set(current.tags || []);
	for (const tag of candidate.tags) {
		if (currentTags.has(tag)) score += 2;
	}
	return score;
}

async function renderRelatedNotes(current: {
	slug: string;
	category: string;
	tags?: string[];
}) {
	const section = document.querySelector<HTMLElement>("#related-notes");
	const list = section?.querySelector<HTMLElement>("#related-notes-list");
	if (!section || !list) return;
	try {
		const notes = await getPublishedNotes();
		const related = notes
			.filter((note) => note.slug !== current.slug)
			.map((note) => ({ note, score: relatedNoteScore(current, note) }))
			.filter(({ score }) => score > 0)
			.sort(
				(left, right) =>
					right.score - left.score ||
					right.note.updated_at - left.note.updated_at,
			)
			.slice(0, 4);
		list.replaceChildren();
		for (const { note } of related) {
			const link = document.createElement("a");
			link.href = `/notes/read/?slug=${encodeURIComponent(note.slug)}`;
			link.className =
				"block rounded-xl border border-[var(--line-color)] bg-white/35 px-4 py-4 transition hover:border-[var(--primary)]/40 hover:bg-white/50";
			const title = document.createElement("h3");
			title.className = "font-bold text-black/80";
			title.textContent = note.title;
			const description = document.createElement("p");
			description.className = "mt-1.5 text-sm text-black/55";
			description.textContent = note.description;
			const meta = document.createElement("p");
			meta.className = "mt-2 text-xs text-black/40";
			meta.textContent = [note.category, ...note.tags.map((tag) => `#${tag}`)]
				.filter(Boolean)
				.join(" · ");
			link.append(title, description, meta);
			list.append(link);
		}
		section.classList.toggle("hidden", related.length === 0);
	} catch {
		section.classList.add("hidden");
	}
}

export function initDynamicNote() {
	const loading = document.querySelector<HTMLElement>("#dynamic-note-loading");
	const article = document.querySelector<HTMLElement>("#dynamic-note");
	const wrapper = document.querySelector<HTMLElement>(
		"#dynamic-note-interactions",
	);
	if (
		!loading ||
		!article ||
		!wrapper ||
		article.dataset.loaded === "true" ||
		loadingNotes.has(article)
	) {
		return;
	}
	loadingNotes.add(article);
	const slug = new URLSearchParams(window.location.search).get("slug") || "";
	void (async () => {
		try {
			const response = await fetch(
				`/api/published-note?slug=${encodeURIComponent(slug)}`,
				{ cache: "no-store" },
			);
			const result = await response.json();
			if (!response.ok)
				throw new Error(result.error || "Failed to load the note.");
			const note = result.note;
			const title = article.querySelector<HTMLElement>("#dynamic-note-title");
			const description = article.querySelector<HTMLElement>(
				"#dynamic-note-description",
			);
			const category = article.querySelector<HTMLElement>(
				"#dynamic-note-category",
			);
			const meta = article.querySelector<HTMLElement>("#dynamic-note-meta");
			const content = article.querySelector<HTMLElement>(
				"#dynamic-note-content",
			);
			if (title) title.textContent = note.title;
			if (description) description.textContent = note.description;
			if (category) category.textContent = note.category;
			if (meta) {
				meta.textContent = `${new Date(note.published_at * 1000).toLocaleString("en-US")} · ${(note.tags || []).join(" · ")}`;
			}
			if (content) {
				if (note.rendered_html.includes('class="katex')) {
					await import("katex/dist/katex.css");
				}
				content.innerHTML = note.rendered_html;
				enhanceCodeBlocks(content);
				enhanceMathBlocks(content);
			}
			document.title = `${note.title} - Cedrian Ian`;
			const interactions =
				wrapper.querySelector<HTMLElement>(".note-interactions");
			if (interactions) interactions.dataset.noteKey = `dynamic:${note.slug}`;
			article.dataset.loaded = "true";
			loading.classList.add("hidden");
			article.classList.remove("hidden");
			wrapper.classList.remove("hidden");
			initNoteInteractions(wrapper);
			void renderRelatedNotes(note);
		} catch (error) {
			loading.textContent =
				error instanceof Error ? error.message : "Failed to load the note.";
			loading.className = "card-base mb-4 px-6 py-7 text-red-700 md:px-9";
		} finally {
			loadingNotes.delete(article);
		}
	})();
}
