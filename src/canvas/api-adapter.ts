import { type CanvasAdapter, ConflictError } from "./adapters";
import { migrateDocument } from "./model";

async function responseJson(
	response: Response,
): Promise<Record<string, unknown>> {
	const body = (await response.json().catch(() => ({}))) as Record<
		string,
		unknown
	>;
	if (!response.ok) {
		if (response.status === 409) throw new ConflictError();
		throw new Error(
			String(body.error || `Request failed (${response.status}).`),
		);
	}
	return body;
}

export function whiteboardApiAdapter(): CanvasAdapter {
	return {
		async loadDocument(id) {
			const query = id.startsWith("slug:")
				? `slug=${encodeURIComponent(id.slice(5))}`
				: `id=${encodeURIComponent(id)}`;
			const body = await responseJson(
				await fetch(`/api/whiteboards?${query}`, { cache: "no-store" }),
			);
			return {
				document: migrateDocument(body.document),
				revision: Number(body.revision),
				readOnly: !body.canEdit,
				metadata: {
					slug: String(body.slug || ""),
					title: String(body.title || "Untitled whiteboard"),
					description: String(body.description || ""),
					category: String(body.category || "Whiteboard"),
					tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
				},
			};
		},
		async saveDocument(id, document, revision, metadata) {
			if (!metadata) throw new Error("Whiteboard metadata is missing.");
			const body = await responseJson(
				await fetch("/api/whiteboards", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ id, revision, document, ...metadata }),
				}),
			);
			return { revision: Number(body.revision) };
		},
		async createDocument(document, metadata) {
			if (!metadata) throw new Error("Whiteboard metadata is missing.");
			const body = await responseJson(
				await fetch("/api/whiteboards", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ document, ...metadata }),
				}),
			);
			return String(body.id);
		},
		async uploadAsset(id, file) {
			const query = new URLSearchParams({ board: id, name: file.name });
			const body = await responseJson(
				await fetch(`/api/whiteboard-assets?${query}`, {
					method: "POST",
					headers: { "Content-Type": file.type || "application/octet-stream" },
					body: file,
				}),
			);
			return { url: String(body.url), name: String(body.name || file.name) };
		},
	};
}
