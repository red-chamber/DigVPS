export interface PublishedNoteSummary {
	slug: string;
	title: string;
	description: string;
	category: string;
	tags: string[];
	published_at: number;
	updated_at: number;
	updateHistory: PublishedNoteUpdate[];
}

export interface PublishedNoteUpdate {
	event_id: string;
	slug: string;
	title: string;
	category: string;
	tags: string[];
	updated_at: number;
}

export interface DeletedStaticNoteSummary {
	note_key: string;
	title: string;
	category: string;
	tags: string[];
	deleted_at: number;
}

interface PublishedNoteData {
	notes: PublishedNoteSummary[];
	deletedStaticNotes: DeletedStaticNoteSummary[];
	deletedDynamicNotes: PublishedNoteSummary[];
}

let publishedNotesRequest: Promise<PublishedNoteData> | null = null;

export function getPublishedNoteData() {
	if (!publishedNotesRequest) {
		publishedNotesRequest = fetch("/api/published-notes", { cache: "no-store" })
			.then(async (response) => {
				const result = await response.json();
				if (!response.ok) {
					throw new Error(result.error || "Failed to load published notes.");
				}
				return {
					notes: (result.notes || []) as PublishedNoteSummary[],
					deletedStaticNotes: (result.deletedStaticNotes ||
						[]) as DeletedStaticNoteSummary[],
					deletedDynamicNotes: (result.deletedDynamicNotes ||
						[]) as PublishedNoteSummary[],
				};
			})
			.catch((error) => {
				publishedNotesRequest = null;
				throw error;
			});
	}
	return publishedNotesRequest;
}

export async function getPublishedNotes() {
	return (await getPublishedNoteData()).notes;
}

export async function getDeletedStaticNotes() {
	return (await getPublishedNoteData()).deletedStaticNotes;
}

export function invalidatePublishedNotes() {
	publishedNotesRequest = null;
}
