import {
	getPublishedNoteData,
	type PublishedNoteSummary,
} from "./published-notes";

const runningIndexes = new WeakSet<HTMLElement>();

function categoryKey(value: string) {
	return value.trim().toLocaleLowerCase("zh-CN");
}

function selectedValues(params: URLSearchParams, name: string) {
	return params
		.getAll(name)
		.map((value) => value.trim())
		.filter(Boolean);
}

function noteTags(link: HTMLElement) {
	try {
		const tags = JSON.parse(link.dataset.noteTags || "[]");
		return Array.isArray(tags) ? tags.map((tag) => categoryKey(String(tag))) : [];
	} catch {
		return [];
	}
}

function applyNoteFilter(root: HTMLElement, total: HTMLElement) {
	const params = new URLSearchParams(window.location.search);
	const categories = selectedValues(params, "category");
	const tags = selectedValues(params, "tag");
	const categoryKeys = new Set(categories.map(categoryKey));
	const tagKeys = new Set(tags.map(categoryKey));
	const uncategorized = params.get("uncategorized") === "true";
	const active = categoryKeys.size > 0 || tagKeys.size > 0 || uncategorized;
	let visibleTotal = 0;

	for (const section of root.querySelectorAll<HTMLElement>(
		".note-category-section[data-note-category]",
	)) {
		let visibleInSection = 0;
		for (const link of section.querySelectorAll<HTMLElement>(
			"[data-static-note-key], [data-dynamic-note-key]",
		)) {
			const noteCategory = categoryKey(link.dataset.noteCategory || "");
			const tagsForNote = noteTags(link);
			const categoryMatches =
				categoryKeys.size === 0 || categoryKeys.has(noteCategory);
			const uncategorizedMatches = !uncategorized || !noteCategory;
			const tagMatches =
				tagKeys.size === 0 || tagsForNote.some((tag) => tagKeys.has(tag));
			const visible = categoryMatches && uncategorizedMatches && tagMatches;
			link.classList.toggle("hidden", !visible);
			if (visible) visibleInSection += 1;
		}
		section.classList.toggle("hidden", visibleInSection === 0);
		const count = section.querySelector<HTMLElement>(".note-category-count");
		if (count) {
			count.textContent = `${visibleInSection} ${visibleInSection === 1 ? "note" : "notes"}`;
		}
		const sectionKey = categoryKey(section.dataset.noteCategory || "");
		const navigation = Array.from(
			root.querySelectorAll<HTMLElement>(
				"#notes-category-nav [data-note-category]",
			),
		).find(
			(item) => categoryKey(item.dataset.noteCategory || "") === sectionKey,
		);
		navigation?.classList.toggle("hidden", visibleInSection === 0);
		const navigationCount = navigation?.querySelector<HTMLElement>(
			".note-category-nav-count",
		);
		if (navigationCount) navigationCount.textContent = String(visibleInSection);
		visibleTotal += visibleInSection;
	}

	total.textContent = `${visibleTotal} ${visibleTotal === 1 ? "note" : "notes"}`;
	const filter = root.querySelector<HTMLElement>("#notes-active-filter");
	const filterLabel = root.querySelector<HTMLElement>(
		"#notes-active-filter-label",
	);
	const parts = [
		...categories.map((category) => `Category: ${category}`),
		...tags.map((tag) => `Tag: ${tag}`),
		...(uncategorized ? ["Category: Uncategorized"] : []),
	];
	if (filterLabel) filterLabel.textContent = parts.join(" · ");
	filter?.classList.toggle("hidden", !active);
	filter?.classList.toggle("flex", active);
	root
		.querySelector<HTMLElement>("#notes-empty-filter")
		?.classList.toggle("hidden", !active || visibleTotal > 0);
}

function createNoteLink(note: PublishedNoteSummary) {
	const link = document.createElement("a");
	link.dataset.dynamicNoteKey = note.slug;
	link.dataset.noteCategory = note.category;
	link.dataset.noteTags = JSON.stringify(note.tags);
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
	section.dataset.dynamicSection = "";
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
	count.textContent = "0 notes";
	const list = document.createElement("div");
	list.className = "note-category-list divide-y divide-[var(--line-divider)]";
	header.append(heading, count);
	section.append(header, list);

	const nav = document.querySelector<HTMLElement>("#notes-category-nav");
	const navLink = document.createElement("a");
	navLink.href = `#${id}`;
	navLink.dataset.noteCategory = category;
	navLink.dataset.dynamicSection = "";
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
	if (!total || runningIndexes.has(total)) return;
	runningIndexes.add(total);
	void (async () => {
		try {
			const { notes, deletedStaticNotes } = await getPublishedNoteData();
			for (const dynamicNote of document.querySelectorAll(
				"[data-dynamic-note-key]",
			)) {
				dynamicNote.remove();
			}
			for (const dynamicSection of document.querySelectorAll(
				"[data-dynamic-section]",
			)) {
				dynamicSection.remove();
			}
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
				if (label) label.textContent = `${count} ${count === 1 ? "note" : "notes"}`;
				const nav = Array.from(
					document.querySelectorAll<HTMLElement>(
						"#notes-category-nav [data-note-category]",
					),
				).find((item) => categoryKey(item.dataset.noteCategory || "") === key);
				const navCount = nav?.querySelector<HTMLElement>(
					".note-category-nav-count",
				);
				if (navCount) navCount.textContent = String(count);
				if (count === 0) {
					section.remove();
					nav?.remove();
				}
			}
			applyNoteFilter(total.parentElement?.closest("main") || document.body, total);
		} catch (error) {
			const message = document.querySelector<HTMLElement>(
				"#dynamic-notes-error",
			);
			if (message) {
				message.textContent =
					error instanceof Error ? error.message : "Failed to load published notes.";
				message.classList.remove("hidden");
			}
		} finally {
			runningIndexes.delete(total);
		}
	})();
}
