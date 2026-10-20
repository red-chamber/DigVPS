import { migrateDocument } from "../src/canvas/model.ts";
import { json, requestHasSameOrigin } from "./auth.js";
import { normalizeSlug, validPublishedNoteSlug } from "./notes.js";

export const MAX_BOARD_BYTES = 1_500_000;
export function requireWriter(context) {
	if (!context.data?.user)
		return json({ error: "Sign in to edit whiteboards." }, 401);
	if (!requestHasSameOrigin(context.request))
		return json({ error: "Invalid request origin." }, 403);
	return null;
}
export function canEdit(user, board) {
	return Boolean(
		user && (user.id === board.author_id || user.role === "admin"),
	);
}
export function boardInput(body) {
	const title = String(body.title || "").trim();
	const description = String(body.description || "").trim();
	const category = String(body.category || "").trim();
	const slug = normalizeSlug(body.slug);
	const tags = Array.isArray(body.tags)
		? [...new Set(body.tags.map((t) => String(t).trim()).filter(Boolean))]
		: [];
	if (
		!title ||
		title.length > 120 ||
		!description ||
		description.length > 240 ||
		!category ||
		category.length > 60 ||
		!validPublishedNoteSlug(slug) ||
		tags.length > 12 ||
		tags.some((t) => t.length > 40)
	)
		throw new Error(
			"Enter a title (120), introduction (240), category (60), valid slug (80), and up to 12 tags (40 characters each).",
		);
	const document = migrateDocument(body.document);
	document.title = title;
	return { title, description, category, slug, tags, document };
}
export function boardSummary(board, user) {
	return {
		id: board.id,
		slug: board.slug,
		title: board.title,
		description: board.description,
		category: board.category,
		tags: JSON.parse(board.tags_json),
		revision: board.revision,
		createdAt: board.created_at,
		updatedAt: board.updated_at,
		canEdit: canEdit(user, board),
	};
}

function portalTargets(document) {
	return [
		...new Set(
			(document.nodes || [])
				.filter((node) => node.type === "portal")
				.map((node) => String(node.data?.documentId || ""))
				.filter(Boolean),
		),
	];
}

export async function assertNoPortalCycle(db, rootId, document) {
	const pending = portalTargets(document);
	const visited = new Set();
	while (pending.length) {
		const id = pending.shift();
		if (!id || visited.has(id)) continue;
		if (id === rootId) throw new Error("Portal nesting would create a cycle.");
		visited.add(id);
		if (visited.size > 100)
			throw new Error("Portal nesting is too deep to validate safely.");
		const board = await db
			.prepare(
				"SELECT document_json FROM whiteboards WHERE id=?1 AND status='published'",
			)
			.bind(id)
			.first();
		if (!board) continue;
		for (const target of portalTargets(JSON.parse(board.document_json)))
			if (!visited.has(target)) pending.push(target);
	}
}
