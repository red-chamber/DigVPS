import {
	ARCHIVED_TIMELINE_EVENTS,
	STATIC_NOTES,
} from "./static-notes.js";

function parseTags(value) {
	try {
		const tags = JSON.parse(value || "[]");
		return Array.isArray(tags) ? tags.map(String) : [];
	} catch {
		return [];
	}
}

function dateSeconds(value) {
	return Math.floor(new Date(value).getTime() / 1000);
}

function staticEvents() {
	return Array.from(STATIC_NOTES, ([slug, note]) => {
		const candidates = [
			{ date: note.published, action: "published" },
			...(note.history || []),
		];
		if (note.updated && note.updated !== note.published) {
			candidates.push({ date: note.updated, action: "updated" });
		}
		const seen = new Set();
		return candidates
			.filter((event) => event.date)
			.map((event) => ({
				...event,
				iso: new Date(event.date).toISOString(),
			}))
			.filter((event) => {
				const key = `${event.action}:${event.iso}`;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.map((event) => ({
				id: `${slug}:${event.action}:${event.iso}`,
				title: note.title,
				date: dateSeconds(event.iso),
				action: event.action,
				tags: note.tags,
				category: note.category || null,
				available: true,
				source: "static",
				slug,
			}));
	}).flat();
}

function dynamicEvents(notes) {
	return notes.flatMap((note) => {
		const available = note.status === "published";
		const base = {
			id: `dynamic:${note.slug}:published:${note.published_at}`,
			title: note.title,
			date: note.published_at,
			action: "published",
			tags: parseTags(note.tags_json),
			category: note.category || null,
			available,
			source: "dynamic",
			slug: note.slug,
		};
		return note.updated_at !== note.published_at
			? [
					base,
					{
						...base,
						id: `dynamic:${note.slug}:updated:${note.updated_at}`,
						date: note.updated_at,
						action: "updated",
					},
				]
			: [base];
	});
}

function archivedEvents() {
	return ARCHIVED_TIMELINE_EVENTS.map((event) => ({
		...event,
		date: dateSeconds(event.date),
		source: "archived",
	}));
}

export function customTimelineEvent(row) {
	return {
		id: row.id,
		title: row.title,
		date: row.created_at,
		action: "activity",
		tags: [],
		category: null,
		available: true,
		source: "custom",
	};
}

export async function loadTimelineData(db) {
	const [notesResult, deletedStaticResult, customResult, hiddenResult] =
		await db.batch([
			db.prepare(
				`SELECT slug, title, category, tags_json, published_at, updated_at, status
				 FROM published_notes
				 WHERE status IN ('published', 'archived')`,
			),
			db.prepare("SELECT note_key FROM deleted_static_notes"),
			db.prepare(
				`SELECT id, title, created_at
				 FROM public_timeline_events
				 WHERE status = 'published'`,
			),
			db.prepare("SELECT event_id FROM hidden_timeline_events"),
		]);
	const deletedStatic = new Set(
		(deletedStaticResult.results || []).map((row) => row.note_key),
	);
	const hiddenEventIds = (hiddenResult.results || []).map(
		(row) => row.event_id,
	);
	const hidden = new Set(hiddenEventIds);
	const events = [
		...staticEvents().map((event) => ({
			...event,
			available: !deletedStatic.has(`static:${event.slug}`),
		})),
		...dynamicEvents(notesResult.results || []),
		...archivedEvents(),
		...(customResult.results || []).map(customTimelineEvent),
	]
		.filter((event) => !hidden.has(event.id))
		.sort((left, right) => right.date - left.date || left.id.localeCompare(right.id));
	return { events, hiddenEventIds };
}
