import { getPublishedNoteData } from "./published-notes";

const runningTaxonomies = new WeakSet<HTMLElement>();
const pendingTaxonomies = new WeakSet<HTMLElement>();

function normalized(value: string) {
	return value.trim().toLocaleLowerCase("zh-CN");
}

function createCategoryLink(name: string, count: number) {
	const link = document.createElement("a");
	link.href = `/notes/?category=${encodeURIComponent(name)}`;
	link.dataset.categoryName = name;
	link.setAttribute("aria-label", `View all notes in the ${name} category`);
	const button = document.createElement("button");
	button.type = "button";
	button.className =
		"h-10 w-full rounded-lg bg-none pl-2 text-neutral-700 transition-all hover:bg-[var(--btn-plain-bg-hover)] hover:pl-3 hover:text-[var(--primary)]";
	const row = document.createElement("div");
	row.className = "relative mr-2 flex items-center justify-between";
	const label = document.createElement("div");
	label.className =
		"overflow-hidden text-left overflow-ellipsis whitespace-nowrap";
	label.textContent = name;
	const badge = document.createElement("div");
	badge.dataset.categoryCount = "";
	badge.className =
		"ml-4 flex h-7 min-w-[2rem] items-center justify-center rounded-lg bg-[var(--btn-regular-bg)] px-2 text-sm font-bold text-[var(--btn-content)]";
	badge.textContent = String(count);
	row.append(label, badge);
	button.append(row);
	link.append(button);
	return link;
}

function createTagLink(name: string) {
	const link = document.createElement("a");
	link.href = `/notes/?tag=${encodeURIComponent(name)}`;
	link.dataset.tagName = name;
	link.setAttribute("aria-label", `View all notes tagged ${name}`);
	link.className = "btn-regular h-8 rounded-lg px-3 text-sm";
	link.textContent = name;
	return link;
}

export function initPublishedNoteTaxonomy() {
	const categories = document.querySelector<HTMLElement>("#categories");
	const tags = document.querySelector<HTMLElement>("#tags");
	if (!categories || !tags) return;
	const tagList = tags.querySelector<HTMLElement>(":scope > div") || tags;
	if (runningTaxonomies.has(categories)) {
		pendingTaxonomies.add(categories);
		return;
	}
	runningTaxonomies.add(categories);
	void (async () => {
		try {
			const { notes } = await getPublishedNoteData();
			const categoryCounts = new Map<string, { name: string; count: number }>();
			const tagCounts = new Map<string, { name: string; count: number }>();
			for (const note of notes) {
				const category = note.category.trim();
				const key = normalized(category);
				const current = categoryCounts.get(key);
				categoryCounts.set(key, {
					name: current?.name || category,
					count: (current?.count || 0) + 1,
				});
				for (const tag of note.tags) {
					const key = normalized(tag);
					const currentTag = tagCounts.get(key);
					tagCounts.set(key, {
						name: currentTag?.name || tag.trim(),
						count: (currentTag?.count || 0) + 1,
					});
				}
			}

			const categoryLinks = new Map(
				Array.from(
					categories.querySelectorAll<HTMLElement>("[data-category-name]"),
				).map((link) => [normalized(link.dataset.categoryName || ""), link]),
			);
			for (const [key, link] of categoryLinks) {
				const badge = link.querySelector<HTMLElement>("[data-category-count]");
				if (!badge) continue;
				const count = categoryCounts.get(key)?.count || 0;
				if (count === 0) link.remove();
				else badge.textContent = String(count);
			}
			for (const [key, item] of categoryCounts) {
				const existing = categoryLinks.get(key);
				if (!existing) {
					categories.append(createCategoryLink(item.name, item.count));
				}
			}

			const existingTags = new Map(
				Array.from(tags.querySelectorAll<HTMLElement>("[data-tag-name]")).map(
					(link) => [normalized(link.dataset.tagName || ""), link],
				),
			);
			for (const [key, link] of existingTags) {
				if ((tagCounts.get(key)?.count || 0) === 0) {
					link.remove();
				}
			}
			for (const [key, item] of tagCounts) {
				if (!existingTags.has(key)) tagList.append(createTagLink(item.name));
			}
			categories
				.closest("widget-layout")
				?.classList.toggle(
					"hidden",
					!categories.querySelector("[data-category-name]"),
				);
			tags
				.closest("widget-layout")
				?.classList.toggle("hidden", !tags.querySelector("[data-tag-name]"));
		} catch (error) {
			console.error(
				"Failed to load published-note categories and tags.",
				error,
			);
		} finally {
			runningTaxonomies.delete(categories);
			if (pendingTaxonomies.delete(categories)) initPublishedNoteTaxonomy();
		}
	})();
}
