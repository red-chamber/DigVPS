import {
	getPublishedNotes,
	type PublishedNoteSummary,
} from "./published-notes";

const runningIndexes = new WeakSet<HTMLElement>();

function taxonomyKey(value: string) {
	return value.trim().toLocaleLowerCase("zh-CN");
}

function selectedValues(params: URLSearchParams, name: string) {
	return params
		.getAll(name)
		.map((value) => value.trim())
		.filter(Boolean);
}

function matchesFilter(
	note: PublishedNoteSummary,
	categoryKeys: Set<string>,
	tagKeys: Set<string>,
	uncategorized: boolean,
) {
	const noteCategory = taxonomyKey(note.category);
	return (
		(categoryKeys.size === 0 || categoryKeys.has(noteCategory)) &&
		(!uncategorized || !noteCategory) &&
		(tagKeys.size === 0 ||
			note.tags.some((tag) => tagKeys.has(taxonomyKey(tag))))
	);
}

function createNoteLink(note: PublishedNoteSummary) {
	const link = document.createElement("a");
	link.dataset.dynamicNoteKey = note.slug;
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
	const id = `note-category-${index}`;
	const section = document.createElement("section");
	section.id = id;
	section.className = "card-base mb-4 scroll-mt-24 px-6 py-6 md:px-9 md:py-7";
	const header = document.createElement("div");
	header.className =
		"mb-2 flex items-baseline justify-between gap-4 border-b border-[var(--line-divider)] pb-3";
	const heading = document.createElement("h2");
	heading.className = "font-serif text-2xl font-bold text-black/85";
	heading.textContent = category || "Uncategorized";
	const count = document.createElement("span");
	count.className = "whitespace-nowrap text-sm text-black/40";
	const list = document.createElement("div");
	list.className = "divide-y divide-[var(--line-divider)]";
	header.append(heading, count);
	section.append(header, list);
	return { id, section, count, list };
}

function createCategoryLink(category: string, id: string, count: number) {
	const link = document.createElement("a");
	link.href = `#${id}`;
	link.className = "btn-regular rounded-lg px-3 py-2 text-sm font-medium";
	link.append(document.createTextNode(category || "Uncategorized"));
	const badge = document.createElement("span");
	badge.className = "ml-1.5 text-black/35";
	badge.textContent = String(count);
	link.append(badge);
	return link;
}

export function initNotesIndex() {
	const total = document.querySelector<HTMLElement>("#notes-total-count");
	const listRoot = document.querySelector<HTMLElement>("#notes-list");
	const navigation = document.querySelector<HTMLElement>("#notes-category-nav");
	if (!total || !listRoot || !navigation || runningIndexes.has(total)) return;
	runningIndexes.add(total);
	void (async () => {
		try {
			const params = new URLSearchParams(window.location.search);
			const categories = selectedValues(params, "category");
			const tags = selectedValues(params, "tag");
			const categoryKeys = new Set(categories.map(taxonomyKey));
			const tagKeys = new Set(tags.map(taxonomyKey));
			const uncategorized = params.get("uncategorized") === "true";
			const active = categoryKeys.size > 0 || tagKeys.size > 0 || uncategorized;
			const notes = (await getPublishedNotes()).filter((note) =>
				matchesFilter(note, categoryKeys, tagKeys, uncategorized),
			);

			listRoot.replaceChildren();
			navigation.replaceChildren();
			const grouped = new Map<string, PublishedNoteSummary[]>();
			for (const note of notes) {
				const key = note.category.trim();
				const group = grouped.get(key) || [];
				group.push(note);
				grouped.set(key, group);
			}
			const groups = Array.from(grouped.entries()).sort(([left], [right]) =>
				left.localeCompare(right, "en", { sensitivity: "base" }),
			);
			for (const [index, [category, group]] of groups.entries()) {
				const { id, section, count, list } = createCategorySection(
					category,
					index + 1,
				);
				count.textContent = `${group.length} ${group.length === 1 ? "note" : "notes"}`;
				for (const note of group) list.append(createNoteLink(note));
				listRoot.append(section);
				navigation.append(createCategoryLink(category, id, group.length));
			}

			total.textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
			const filter = document.querySelector<HTMLElement>(
				"#notes-active-filter",
			);
			const filterLabel = document.querySelector<HTMLElement>(
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
			document
				.querySelector<HTMLElement>("#notes-empty-filter")
				?.classList.toggle("hidden", notes.length > 0);
		} catch (error) {
			const message = document.querySelector<HTMLElement>(
				"#dynamic-notes-error",
			);
			if (message) {
				message.textContent =
					error instanceof Error
						? error.message
						: "Failed to load published notes.";
				message.classList.remove("hidden");
			}
		} finally {
			runningIndexes.delete(total);
		}
	})();
}
