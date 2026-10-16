import {
	getPublishedNoteData,
	type PublishedNoteSummary,
} from "./published-notes";

const initializedIndexes = new WeakSet<HTMLElement>();

function categoryKey(value: string) {
	return value.trim().toLocaleLowerCase("zh-CN");
}

function createNoteLink(note: PublishedNoteSummary) {
	const link = document.createElement("a");
	link.href = `/notes/read/?slug=${encodeURIComponent(note.slug)}`;
	link.className =
		"group flex items-center justify-between gap-4 rounded-md py-3.5 transition-all hover:bg-[var(--btn-plain-bg-hover)] hover:px-3";
	const body = document.createElement("div");
	body.className = "min-w-0";
	const title = document.createElement("div");
	title.className =
		"font-medium text-black/75 transition-colors group-hover:text-[var(--primary)]";
	title.textContent = note.title;
	const description = document.createElement("div");
	description.className = "mt-1 line-clamp-2 text-sm text-black/45";
	description.textContent = note.description;
	const tags = document.createElement("div");
	tags.className = "mt-1 truncate text-xs text-black/35";
	tags.textContent = note.tags.map((tag) => `#${tag}`).join(" ");
	const arrow = document.createElement("span");
	arrow.className =
		"shrink-0 text-xl text-black/25 transition-colors group-hover:text-[var(--primary)]";
	arrow.textContent = "›";
	body.append(title, description);
	if (note.tags.length) body.append(tags);
	link.append(body, arrow);
	return link;
}

function createCategorySection(category: string, index: number) {
	const id = `dynamic-note-category-${index}`;
	const section = document.createElement("section");
	section.id = id;
	section.dataset.noteCategory = category;
	section.dataset.staticCount = "0";
	section.className =
		"note-category-section card-base mb-4 scroll-mt-24 px-6 py-6 md:px-9 md:py-7";
	const header = document.createElement("div");
	header.className =
		"mb-2 flex items-baseline justify-between gap-4 border-b border-[var(--line-divider)] pb-3";
	const heading = document.createElement("h2");
	heading.className = "font-serif text-2xl font-bold text-black/85";
	heading.textContent = category;
	const count = document.createElement("span");
	count.className =
		"note-category-count whitespace-nowrap text-sm text-black/40";
	count.textContent = "0 篇";
	const list = document.createElement("div");
	list.className = "note-category-list divide-y divide-[var(--line-divider)]";
	header.append(heading, count);
	section.append(header, list);

	const nav = document.querySelector<HTMLElement>("#notes-category-nav");
	const navLink = document.createElement("a");
	navLink.href = `#${id}`;
	navLink.dataset.noteCategory = category;
	navLink.className = "btn-regular rounded-lg px-3 py-2 text-sm font-medium";
	navLink.append(document.createTextNode(category));
	const navCount = document.createElement("span");
	navCount.className = "note-category-nav-count ml-1.5 text-black/35";
	navCount.dataset.staticCount = "0";
	navCount.textContent = "0";
	navLink.append(navCount);
	nav?.append(navLink);
	return section;
}

export function initNotesIndex() {
	const total = document.querySelector<HTMLElement>("#notes-total-count");
	if (!total || initializedIndexes.has(total)) return;
	initializedIndexes.add(total);
	void (async () => {
		try {
			const { notes, deletedStaticNotes } = await getPublishedNoteData();
			const deletedKeys = new Set(
				deletedStaticNotes.map((note) => note.note_key),
			);
			for (const link of document.querySelectorAll<HTMLElement>(
				"[data-static-note-key]",
			)) {
				if (deletedKeys.has(link.dataset.staticNoteKey || "")) link.remove();
			}
			const sections = new Map<string, HTMLElement>();
			for (const section of document.querySelectorAll<HTMLElement>(
				".note-category-section[data-note-category]",
			)) {
				section.dataset.staticCount = String(
					section.querySelectorAll("[data-static-note-key]").length,
				);
				sections.set(categoryKey(section.dataset.noteCategory || ""), section);
			}
			const dynamicCounts = new Map<string, number>();
			for (const [index, note] of notes.entries()) {
				const key = categoryKey(note.category);
				let section = sections.get(key);
				if (!section) {
					section = createCategorySection(note.category, index + 1);
					document.querySelector("#dynamic-notes-error")?.before(section);
					sections.set(key, section);
				}
				section
					.querySelector<HTMLElement>(".note-category-list")
					?.prepend(createNoteLink(note));
				dynamicCounts.set(key, (dynamicCounts.get(key) || 0) + 1);
			}

			for (const [key, section] of sections) {
				const count =
					Number(section.dataset.staticCount || 0) +
					(dynamicCounts.get(key) || 0);
				const label = section.querySelector<HTMLElement>(
					".note-category-count",
				);
				if (label) label.textContent = `${count} 篇`;
				const nav = Array.from(
					document.querySelectorAll<HTMLElement>(
						"#notes-category-nav [data-note-category]",
					),
				).find((item) => categoryKey(item.dataset.noteCategory || "") === key);
				const navCount = nav?.querySelector<HTMLElement>(
					".note-category-nav-count",
				);
				if (navCount) navCount.textContent = String(count);
				section.classList.toggle("hidden", count === 0);
				nav?.classList.toggle("hidden", count === 0);
			}
			const visibleStaticCount = document.querySelectorAll(
				".note-category-list [data-static-note-key]",
			).length;
			total.textContent = String(visibleStaticCount + notes.length);
		} catch (error) {
			const message = document.querySelector<HTMLElement>(
				"#dynamic-notes-error",
			);
			if (message) {
				message.textContent =
					error instanceof Error ? error.message : "在线笔记读取失败。";
				message.classList.remove("hidden");
			}
		}
	})();
}
