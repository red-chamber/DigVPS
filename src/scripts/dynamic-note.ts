import { initNoteInteractions } from "./note-interactions";

const loadingNotes = new WeakSet<HTMLElement>();

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
			if (!response.ok) throw new Error(result.error || "Failed to load the note.");
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
			if (content) content.innerHTML = note.rendered_html;
			document.title = `${note.title} - Cedrian Ian`;
			const interactions =
				wrapper.querySelector<HTMLElement>(".note-interactions");
			if (interactions) interactions.dataset.noteKey = `dynamic:${note.slug}`;
			article.dataset.loaded = "true";
			loading.classList.add("hidden");
			article.classList.remove("hidden");
			wrapper.classList.remove("hidden");
			initNoteInteractions(wrapper);
		} catch (error) {
			loading.textContent =
				error instanceof Error ? error.message : "Failed to load the note.";
			loading.className = "card-base mb-4 px-6 py-7 text-red-700 md:px-9";
		} finally {
			loadingNotes.delete(article);
		}
	})();
}
