export interface PublishedNoteSummary {
	slug: string;
	title: string;
	description: string;
	category: string;
	tags: string[];
	published_at: number;
	updated_at: number;
}

let publishedNotesRequest: Promise<PublishedNoteSummary[]> | null = null;

export function getPublishedNotes() {
	if (!publishedNotesRequest) {
		publishedNotesRequest = fetch("/api/published-notes", { cache: "no-store" })
			.then(async (response) => {
				const result = await response.json();
				if (!response.ok) {
					throw new Error(result.error || "在线笔记读取失败。");
				}
				return (result.notes || []) as PublishedNoteSummary[];
			})
			.catch((error) => {
				publishedNotesRequest = null;
				throw error;
			});
	}
	return publishedNotesRequest;
}

export function invalidatePublishedNotes() {
	publishedNotesRequest = null;
}
