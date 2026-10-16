const initializedIndexes = new WeakSet<HTMLElement>();

export function initNotesIndex() {
	const root = document.querySelector<HTMLElement>("#dynamic-notes-section");
	if (!root || initializedIndexes.has(root)) return;
	initializedIndexes.add(root);
	void (async () => {
		try {
			const response = await fetch("/api/published-notes", {
				cache: "no-store",
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "在线笔记读取失败。");
			const notes = result.notes || [];
			if (!notes.length) {
				root.classList.add("hidden");
				return;
			}
			const count = root.querySelector<HTMLElement>(".dynamic-notes-count");
			const list = root.querySelector<HTMLElement>(".dynamic-notes-list");
			if (count) count.textContent = `${notes.length} 篇`;
			list?.replaceChildren();
			for (const note of notes) {
				const link = document.createElement("a");
				link.href = `/notes/read/?slug=${encodeURIComponent(note.slug)}`;
				link.className =
					"group block rounded-md py-3.5 transition-all hover:bg-[var(--btn-plain-bg-hover)] hover:px-3";
				const title = document.createElement("div");
				title.className =
					"font-medium text-black/75 transition-colors group-hover:text-[var(--primary)]";
				title.textContent = note.title;
				const description = document.createElement("div");
				description.className = "mt-1 line-clamp-2 text-sm text-black/45";
				description.textContent = note.description;
				link.append(title, description);
				list?.append(link);
			}
			root.classList.remove("hidden");
		} catch (error) {
			const list = root.querySelector<HTMLElement>(".dynamic-notes-list");
			if (list)
				list.textContent =
					error instanceof Error ? error.message : "在线笔记读取失败。";
			root.classList.remove("hidden");
		}
	})();
}
