import type { SearchResult } from "@/global";
import { url } from "../utils/url-utils";

interface PagefindResult {
	data: () => Promise<SearchResult>;
}

interface PagefindApi {
	search: (query: string) => Promise<{ results: PagefindResult[] }>;
	options: (options: { excerptLength: number }) => Promise<void>;
}

const SEARCH_DELAY = 150;
const initializedSearchRoots = new WeakSet<HTMLElement>();

let pagefindPromise: Promise<PagefindApi | null> | null = null;

const developmentResults: SearchResult[] = [
	{
		url: url("/"),
		meta: { title: "This Is a Fake Search Result" },
		excerpt:
			"Because the search cannot work in the <mark>dev</mark> environment.",
	},
	{
		url: url("/"),
		meta: { title: "If You Want to Test the Search" },
		excerpt: "Try running <mark>npm build && npm preview</mark> instead.",
	},
];

async function loadPagefind() {
	if (import.meta.env.DEV) return null;
	if (window.pagefind) return window.pagefind as PagefindApi;
	pagefindPromise ??= (async () => {
		try {
			const scriptUrl = url("/pagefind/pagefind.js");
			const pagefind = (await import(
				/* @vite-ignore */ scriptUrl
			)) as PagefindApi;
			await pagefind.options({ excerptLength: 20 });
			window.pagefind = pagefind;
			return pagefind;
		} catch (error) {
			console.error("Failed to load Pagefind:", error);
			return null;
		}
	})();
	return pagefindPromise;
}

function renderResults(root: HTMLElement, results: SearchResult[]) {
	const container = root.querySelector<HTMLElement>("#search-results");
	const template = root.querySelector<HTMLTemplateElement>(
		"#search-result-template",
	);
	if (!container || !template) return;
	container.replaceChildren();
	for (const result of results) {
		const fragment = template.content.cloneNode(true) as DocumentFragment;
		const link = fragment.querySelector<HTMLAnchorElement>("a");
		const title = fragment.querySelector<HTMLElement>("[data-search-title]");
		const excerpt = fragment.querySelector<HTMLElement>(
			"[data-search-excerpt]",
		);
		if (link) link.href = result.url;
		if (title) title.textContent = result.meta.title;
		if (excerpt) excerpt.innerHTML = result.excerpt;
		container.append(fragment);
	}
}

export function initSearch() {
	const root = document.querySelector<HTMLElement>("#navbar");
	if (!root || initializedSearchRoots.has(root)) return;
	initializedSearchRoots.add(root);

	const panel = root.querySelector<HTMLElement>("#search-panel");
	const desktopInput = root.querySelector<HTMLInputElement>(
		"#search-input-desktop",
	);
	const mobileInput = root.querySelector<HTMLInputElement>(
		"#search-input-mobile",
	);
	const mobileSwitch = root.querySelector<HTMLButtonElement>("#search-switch");
	let searchTimer = 0;
	let searchVersion = 0;

	const runSearch = async (input: HTMLInputElement, desktop: boolean) => {
		const keyword = input.value.trim();
		const version = ++searchVersion;
		if (!keyword) {
			renderResults(root, []);
			if (desktop) panel?.classList.add("float-panel-closed");
			return;
		}
		const pagefind = await loadPagefind();
		const results = import.meta.env.DEV
			? developmentResults
			: pagefind
				? await Promise.all(
						(await pagefind.search(keyword)).results.map((item) => item.data()),
					)
				: [];
		if (version !== searchVersion) return;
		renderResults(root, results);
		if (desktop) panel?.classList.toggle("float-panel-closed", !results.length);
	};

	const scheduleSearch = (input: HTMLInputElement, desktop: boolean) => {
		window.clearTimeout(searchTimer);
		searchTimer = window.setTimeout(
			() => void runSearch(input, desktop),
			SEARCH_DELAY,
		);
	};

	desktopInput?.addEventListener("focus", () => {
		void loadPagefind();
		if (desktopInput.value) scheduleSearch(desktopInput, true);
	});
	desktopInput?.addEventListener("input", () =>
		scheduleSearch(desktopInput, true),
	);
	mobileInput?.addEventListener("focus", () => void loadPagefind());
	mobileInput?.addEventListener("input", () =>
		scheduleSearch(mobileInput, false),
	);
	mobileSwitch?.addEventListener("click", () => {
		panel?.classList.toggle("float-panel-closed");
		void loadPagefind();
	});
}
