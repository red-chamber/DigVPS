<script lang="ts">
import { onMount } from "svelte";
import { getPublishedNoteData } from "../scripts/published-notes";
import { getTimelineData } from "../scripts/timeline-data";

const params = new URLSearchParams(window.location.search);
const tags = params.has("tag") ? params.getAll("tag") : [];
const categories = params.has("category") ? params.getAll("category") : [];
const uncategorized = params.get("uncategorized");

interface TimelineEntry {
	id: string;
	title: string;
	tags: string[];
	category?: string | null;
	date: Date;
	action: "published" | "updated" | "activity";
	available: boolean;
	slug?: string;
	url?: string;
}

interface Group {
	year: number;
	entries: TimelineEntry[];
}

let groups: Group[] = [];

function formatDate(date: Date) {
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${month}-${day}`;
}

function formatTag(tagList: string[]) {
	return tagList.map((t) => `#${t}`).join(" ");
}

function entryHref(entry: TimelineEntry) {
	if (!entry.available) return undefined;
	return entry.url;
}

function actionLabel(action: TimelineEntry["action"]) {
	if (action === "updated") return "Updated";
	if (action === "activity") return "Activity";
	return "Published";
}

onMount(async () => {
	let dynamicEntries: TimelineEntry[] = [];
	let customEntries: TimelineEntry[] = [];
	let hiddenEventIds = new Set<string>();
	try {
		const { notes, deletedDynamicNotes } = await getPublishedNoteData();
		dynamicEntries = notes.flatMap((note) => {
			const published = new Date(note.published_at * 1000);
			const entries: TimelineEntry[] = [
				{
					id: `dynamic:${note.slug}:published:${note.published_at}`,
					title: note.title,
					tags: note.tags,
					category: note.category,
					date: published,
					action: "published",
					available: true,
					url: `/notes/read/?slug=${encodeURIComponent(note.slug)}`,
				},
			];
			entries.push(
				...(note.updateHistory || []).map((update) => ({
					...entries[0],
					id: update.event_id,
					title: update.title,
					tags: update.tags,
					category: update.category,
					date: new Date(update.updated_at * 1000),
					action: "updated" as const,
				})),
			);
			return entries;
		});
		dynamicEntries.push(
			...deletedDynamicNotes.flatMap((note) => {
				const base: TimelineEntry = {
					id: `dynamic:${note.slug}:published:${note.published_at}`,
					title: note.title,
					tags: note.tags,
					category: note.category,
					date: new Date(note.published_at * 1000),
					action: "published",
					available: false,
				};
				return [
					base,
					...(note.updateHistory || []).map((update) => ({
						...base,
						id: update.event_id,
						title: update.title,
						tags: update.tags,
						category: update.category,
						date: new Date(update.updated_at * 1000),
						action: "updated" as const,
					})),
				];
			}),
		);
	} catch (error) {
		console.error("Failed to load the published-note timeline.", error);
	}
	try {
		const timelineData = await getTimelineData();
		hiddenEventIds = new Set(timelineData.hiddenEventIds);
		customEntries = timelineData.events.map((event) => ({
			...event,
			date: new Date(event.date * 1000),
		}));
	} catch (error) {
		console.error("Failed to load the public timeline.", error);
	}
	let filteredEntries: TimelineEntry[] = [
		...dynamicEntries,
		...customEntries,
	]
		.filter((entry) => !hiddenEventIds.has(entry.id))
		.sort((a, b) => b.date.getTime() - a.date.getTime());

	if (tags.length > 0) {
		filteredEntries = filteredEntries.filter(
			(entry) =>
				Array.isArray(entry.tags) &&
				entry.tags.some((tag) => tags.includes(tag)),
		);
	}

	if (categories.length > 0) {
		filteredEntries = filteredEntries.filter(
			(entry) => entry.category && categories.includes(entry.category),
		);
	}

	if (uncategorized) {
		filteredEntries = filteredEntries.filter((entry) => !entry.category);
	}

	const grouped = filteredEntries.reduce(
		(acc, entry) => {
			const year = entry.date.getFullYear();
			if (!acc[year]) {
				acc[year] = [];
			}
			acc[year].push(entry);
			return acc;
		},
		{} as Record<number, TimelineEntry[]>,
	);

	const groupedPostsArray = Object.keys(grouped).map((yearStr) => ({
		year: Number.parseInt(yearStr, 10),
		entries: grouped[Number.parseInt(yearStr, 10)],
	}));

	groupedPostsArray.sort((a, b) => b.year - a.year);

	groups = groupedPostsArray;
});
</script>

<div class="card-base px-8 py-6">
    {#each groups as group}
        <div>
            <div class="flex flex-row w-full items-center h-[3.75rem]">
                <div class="w-[15%] md:w-[10%] transition text-2xl font-bold text-right text-75">
                    {group.year}
                </div>
                <div class="w-[15%] md:w-[10%]">
                    <div
                            class="h-3 w-3 bg-none rounded-full outline outline-[var(--primary)] mx-auto
                  -outline-offset-[2px] z-50 outline-3"
                    ></div>
                </div>
                <div class="w-[70%] md:w-[80%] transition text-left text-50">
                    {group.entries.length} {group.entries.length === 1 ? "record" : "records"}
                </div>
            </div>

            {#each group.entries as entry}
                <svelte:element
                        this={entryHref(entry) ? "a" : "div"}
                        href={entryHref(entry)}
                        aria-label={entry.title}
                        class="group btn-plain !block h-10 w-full rounded-lg hover:text-[initial]"
                        class:opacity-60={!entry.available}
                        class:pointer-events-none={!entry.available}
                >
                    <div class="flex flex-row justify-start items-center h-full">
                        <!-- date -->
                        <div class="w-[15%] md:w-[10%] transition text-sm text-right text-50">
							{formatDate(entry.date)}
                        </div>

                        <!-- dot and line -->
                        <div class="w-[15%] md:w-[10%] relative dash-line h-full flex items-center">
                            <div
                                    class="transition-all mx-auto w-1 h-1 rounded group-hover:h-5
                       bg-[oklch(0.5_0.05_var(--hue))] group-hover:bg-[var(--primary)]
                       outline outline-4 z-50
                       outline-[var(--card-bg)]
                       group-hover:outline-[var(--btn-plain-bg-hover)]
                       group-active:outline-[var(--btn-plain-bg-active)]"
                            ></div>
                        </div>

                        <!-- post title -->
                        <div
                                class="w-[70%] md:max-w-[65%] md:w-[65%] text-left font-bold
                     group-hover:translate-x-1 transition-all group-hover:text-[var(--primary)]
                     text-75 pr-8 whitespace-nowrap overflow-ellipsis overflow-hidden"
                        >
                            {entry.title}
                            <span class="ml-2 text-xs font-normal text-30">
                                {actionLabel(entry.action)}{entry.available ? "" : " (Deleted)"}
                            </span>
                        </div>

                        <!-- tag list -->
                        <div
                                class="hidden md:block md:w-[15%] text-left text-sm transition
                     whitespace-nowrap overflow-ellipsis overflow-hidden text-30"
                        >
                            {formatTag(entry.tags)}
                        </div>
                    </div>
                </svelte:element>
            {/each}
        </div>
    {/each}
</div>
