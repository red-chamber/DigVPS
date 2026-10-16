import { getPublishedNoteData } from "./published-notes";

const initializedTaxonomies = new WeakSet<HTMLElement>();

function normalized(value: string) {
	return value.trim().toLocaleLowerCase("zh-CN");
}

function createCategoryLink(name: string, count: number) {
	const link = document.createElement("a");
	link.href = `/archive/?category=${encodeURIComponent(name)}`;
	link.dataset.categoryName = name;
	link.setAttribute("aria-label", `查看 ${name} 分类下的全部笔记`);
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
	badge.dataset.staticCount = "0";
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
	link.href = `/archive/?tag=${encodeURIComponent(name)}`;
	link.dataset.tagName = name;
	link.setAttribute("aria-label", `查看带有 ${name} 标签的全部笔记`);
	link.className = "btn-regular h-8 rounded-lg px-3 text-sm";
	link.textContent = name;
	return link;
}

export function initPublishedNoteTaxonomy() {
	const categories = document.querySelector<HTMLElement>("#categories");
	const tags = document.querySelector<HTMLElement>("#tags");
	if (!categories || !tags || initializedTaxonomies.has(categories)) return;
	initializedTaxonomies.add(categories);
	void (async () => {
		try {
			const { notes, deletedStaticNotes } = await getPublishedNoteData();
			const deletedKeys = new Set(
				deletedStaticNotes.map((note) => note.note_key),
			);
			for (const card of document.querySelectorAll<HTMLElement>(
				"[data-static-note-key]",
			)) {
				if (!deletedKeys.has(card.dataset.staticNoteKey || "")) continue;
				const separator = card.nextElementSibling;
				card.remove();
				if (separator?.classList.contains("border-dashed")) separator.remove();
			}
			const categoryCounts = new Map<string, { name: string; count: number }>();
			const tagNames = new Map<string, string>();
			for (const note of notes) {
				const category = note.category.trim();
				const key = normalized(category);
				const current = categoryCounts.get(key);
				categoryCounts.set(key, {
					name: current?.name || category,
					count: (current?.count || 0) + 1,
				});
				for (const tag of note.tags) {
					tagNames.set(normalized(tag), tag.trim());
				}
			}

			const categoryLinks = new Map(
				Array.from(
					categories.querySelectorAll<HTMLElement>("[data-category-name]"),
				).map((link) => [normalized(link.dataset.categoryName || ""), link]),
			);
			const deletedCategoryCounts = new Map<string, number>();
			for (const note of deletedStaticNotes) {
				const key = normalized(note.category);
				deletedCategoryCounts.set(
					key,
					(deletedCategoryCounts.get(key) || 0) + 1,
				);
			}
			for (const [key, link] of categoryLinks) {
				const badge = link.querySelector<HTMLElement>("[data-category-count]");
				if (!badge) continue;
				const staticCount = Math.max(
					0,
					Number(badge.dataset.staticCount || 0) -
						(deletedCategoryCounts.get(key) || 0),
				);
				badge.dataset.staticCount = String(staticCount);
				badge.textContent = String(staticCount);
			}
			for (const [key, item] of categoryCounts) {
				const existing = categoryLinks.get(key);
				if (existing) {
					const badge = existing.querySelector<HTMLElement>(
						"[data-category-count]",
					);
					if (badge) {
						badge.textContent = String(
							Number(badge.dataset.staticCount || 0) + item.count,
						);
					}
				} else {
					categories.append(createCategoryLink(item.name, item.count));
				}
			}

			const existingTags = new Set(
				Array.from(tags.querySelectorAll<HTMLElement>("[data-tag-name]")).map(
					(link) => normalized(link.dataset.tagName || ""),
				),
			);
			for (const [key, name] of tagNames) {
				if (!existingTags.has(key)) tags.append(createTagLink(name));
			}
		} catch (error) {
			console.error("在线笔记分类与标签读取失败。", error);
		}
	})();
}
