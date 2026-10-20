import { json, randomToken } from "../../server/auth.js";
import { canEdit, requireWriter } from "../../server/whiteboards.js";

const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const CHUNK_BYTES = 64 * 1024;
export async function onRequestPost(context) {
	const denied = requireWriter(context);
	if (denied) return denied;
	const params = new URL(context.request.url).searchParams;
	const board = await context.env.DB.prepare(
		"SELECT author_id FROM whiteboards WHERE id=?1 AND status='published'",
	)
		.bind(params.get("board"))
		.first();
	if (!board || !canEdit(context.data.user, board))
		return json({ error: "No permission to upload to this whiteboard." }, 403);
	if (Number(context.request.headers.get("Content-Length")) > MAX_ASSET_BYTES)
		return json({ error: "Maximum attachment size: 8 MB." }, 413);
	const bytes = new Uint8Array(await context.request.arrayBuffer());
	if (!bytes.length || bytes.length > MAX_ASSET_BYTES)
		return json({ error: "Maximum attachment size: 8 MB." }, 413);
	const usage = await context.env.DB.prepare(
		"SELECT COALESCE(SUM(size),0) AS size FROM whiteboard_assets WHERE board_id=?1",
	)
		.bind(params.get("board"))
		.first();
	if (usage.size + bytes.length > 64 * 1024 * 1024)
		return json(
			{ error: "Whiteboard attachment storage is limited to 64 MB." },
			413,
		);
	const id = randomToken(18);
	const name = String(params.get("name") || "attachment").slice(0, 200);
	const mime =
		context.request.headers.get("Content-Type") || "application/octet-stream";
	const statements = [
		context.env.DB.prepare(
			"INSERT INTO whiteboard_assets (id,board_id,name,mime,size,created_at) VALUES (?1,?2,?3,?4,?5,?6)",
		).bind(
			id,
			params.get("board"),
			name,
			mime,
			bytes.length,
			Math.floor(Date.now() / 1000),
		),
	];
	for (let i = 0; i < bytes.length; i += CHUNK_BYTES)
		statements.push(
			context.env.DB.prepare(
				"INSERT INTO whiteboard_asset_chunks (asset_id,part,content) VALUES (?1,?2,?3)",
			).bind(id, i / CHUNK_BYTES, bytes.slice(i, i + CHUNK_BYTES).buffer),
		);
	await context.env.DB.batch(statements);
	return json({ url: `/api/whiteboard-assets?id=${id}`, name }, 201);
}
export async function onRequestGet(context) {
	const id = new URL(context.request.url).searchParams.get("id");
	const asset = await context.env.DB.prepare(
		"SELECT a.* FROM whiteboard_assets a JOIN whiteboards b ON b.id=a.board_id WHERE a.id=?1 AND b.status='published'",
	)
		.bind(id)
		.first();
	if (!asset) return json({ error: "Attachment not found." }, 404);
	const chunks = await context.env.DB.prepare(
		"SELECT content FROM whiteboard_asset_chunks WHERE asset_id=?1 ORDER BY part",
	)
		.bind(id)
		.all();
	const bytes = new Uint8Array(asset.size);
	let offset = 0;
	for (const chunk of chunks.results) {
		const part = new Uint8Array(chunk.content);
		bytes.set(part, offset);
		offset += part.length;
	}
	const image = ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
		asset.mime,
	);
	return new Response(bytes, {
		headers: {
			"Content-Type": image ? asset.mime : "application/octet-stream",
			"Content-Disposition": `${image ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": "default-src 'none'; sandbox",
			"Cache-Control": "private, no-store",
		},
	});
}
