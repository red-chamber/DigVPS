function parseTags(value) {
	try {
		const tags = JSON.parse(value || "[]");
		return Array.isArray(tags) ? tags.map(String) : [];
	} catch {
		return [];
	}
}

function dynamicEvents(notes, updateHistory) {
	const updatesByNote = new Map();
	for (const update of updateHistory) {
		const updates = updatesByNote.get(update.note_id) || [];
		updates.push(update);
		updatesByNote.set(update.note_id, updates);
	}
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
		const updates = updatesByNote.get(note.id) || [];
		if (!updates.length && note.updated_at !== note.published_at) {
			updates.push({
				event_id: `dynamic:${note.slug}:updated:${note.updated_at}`,
				slug: note.slug,
				title: note.title,
				category: note.category,
				tags_json: note.tags_json,
				updated_at: note.updated_at,
			});
		}
		return [
			base,
			...updates.map((update) => ({
				...base,
				id: update.event_id,
				title: update.title,
				date: update.updated_at,
				action: "updated",
				tags: parseTags(update.tags_json),
				category: update.category || null,
			})),
		];
	});
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
	const [notesResult, updateHistoryResult, customResult, hiddenResult] =
		await db.batch([
			db.prepare(
				`SELECT id, slug, title, category, tags_json, published_at, updated_at, status
				 FROM published_notes
				 WHERE status IN ('published', 'archived')`,
			),
			db.prepare(
				`SELECT event_id, note_id, slug, title, category, tags_json, updated_at
				 FROM note_update_history`,
			),
			db.prepare(
				`SELECT id, title, created_at
				 FROM public_timeline_events
				 WHERE status = 'published'`,
			),
			db.prepare("SELECT event_id FROM hidden_timeline_events"),
		]);
	const hiddenEventIds = (hiddenResult.results || []).map(
		(row) => row.event_id,
	);
	const hidden = new Set(hiddenEventIds);
	const events = [
		...dynamicEvents(
			notesResult.results || [],
			updateHistoryResult.results || [],
		),
		...(customResult.results || []).map(customTimelineEvent),
	]
		.filter((event) => !hidden.has(event.id))
		.sort(
			(left, right) =>
				right.date - left.date || left.id.localeCompare(right.id),
		);
	return { events, hiddenEventIds };
}
