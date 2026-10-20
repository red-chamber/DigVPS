import {
	json,
	randomToken,
	readJson,
	recordActivity,
} from "../../server/auth.js";
import {
	assertNoPortalCycle,
	boardInput,
	boardSummary,
	canEdit,
	MAX_BOARD_BYTES,
	requireWriter,
} from "../../server/whiteboards.js";

export async function onRequestGet(context) {
	const params = new URL(context.request.url).searchParams;
	const id = params.get("id");
	const slug = params.get("slug");
	if (id || slug) {
		const board = await context.env.DB.prepare(
			"SELECT * FROM whiteboards WHERE status = 'published' AND (id = ?1 OR slug = ?2)",
		)
			.bind(id, slug)
			.first();
		if (!board) return json({ error: "Whiteboard not found." }, 404);
		return json({
			...boardSummary(board, context.data.user),
			document: JSON.parse(board.document_json),
		});
	}
	const result = await context.env.DB.prepare(
		"SELECT id, slug, title, description, category, tags_json, author_id, revision, created_at, updated_at FROM whiteboards WHERE status = 'published' ORDER BY updated_at DESC",
	).all();
	return json({
		boards: (result.results || []).map((b) =>
			boardSummary(b, context.data.user),
		),
		canCreate: Boolean(context.data.user),
	});
}
export async function onRequestPost(context) {
	const denied = requireWriter(context);
	if (denied) return denied;
	try {
		const input = boardInput(await readJson(context.request, MAX_BOARD_BYTES));
		const id = randomToken(18);
		input.document.id = id;
		await assertNoPortalCycle(context.env.DB, id, input.document);
		const now = Math.floor(Date.now() / 1000);
		await context.env.DB.prepare(
			"INSERT INTO whiteboards (id, slug, title, description, category, tags_json, document_json, author_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
		)
			.bind(
				id,
				input.slug,
				input.title,
				input.description,
				input.category,
				JSON.stringify(input.tags),
				JSON.stringify(input.document),
				context.data.user.id,
				now,
			)
			.run();
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: "whiteboard_created",
			path: `/whiteboards/edit/?id=${id}`,
		});
		return json({ id, revision: 1 }, 201);
	} catch (error) {
		return json(
			{
				error: /UNIQUE/u.test(error.message)
					? "This slug already exists."
					: error.message,
			},
			/UNIQUE/u.test(error.message) ? 409 : 400,
		);
	}
}
export async function onRequestPut(context) {
	const denied = requireWriter(context);
	if (denied) return denied;
	try {
		const body = await readJson(context.request, MAX_BOARD_BYTES);
		const board = await context.env.DB.prepare(
			"SELECT * FROM whiteboards WHERE id = ?1 AND status = 'published'",
		)
			.bind(String(body.id))
			.first();
		if (!board) return json({ error: "Whiteboard not found." }, 404);
		if (!canEdit(context.data.user, board))
			return json(
				{
					error:
						"Only the author or an administrator may edit this whiteboard.",
				},
				403,
			);
		const input = boardInput(body);
		input.document.id = board.id;
		await assertNoPortalCycle(context.env.DB, board.id, input.document);
		const result = await context.env.DB.prepare(
			"UPDATE whiteboards SET slug=?1, title=?2, description=?3, category=?4, tags_json=?5, document_json=?6, revision=revision+1, updated_at=?7 WHERE id=?8 AND revision=?9 AND status='published'",
		)
			.bind(
				input.slug,
				input.title,
				input.description,
				input.category,
				JSON.stringify(input.tags),
				JSON.stringify(input.document),
				Math.floor(Date.now() / 1000),
				board.id,
				body.revision,
			)
			.run();
		if (!result.meta.changes)
			return json(
				{
					error:
						"A newer revision exists. Export your changes before reloading.",
					conflict: true,
				},
				409,
			);
		return json({ revision: body.revision + 1 });
	} catch (error) {
		return json(
			{
				error: /UNIQUE/u.test(error.message)
					? "This slug already exists."
					: error.message,
			},
			/UNIQUE/u.test(error.message) ? 409 : 400,
		);
	}
}
export async function onRequestDelete(context) {
	const denied = requireWriter(context);
	if (denied) return denied;
	const body = await readJson(context.request);
	const board = await context.env.DB.prepare(
		"SELECT * FROM whiteboards WHERE id = ?1 AND status = 'published'",
	)
		.bind(String(body.id))
		.first();
	if (!board) return json({ error: "Whiteboard not found." }, 404);
	if (!canEdit(context.data.user, board))
		return json(
			{
				error:
					"Only the author or an administrator may delete this whiteboard.",
			},
			403,
		);
	const result = await context.env.DB.prepare(
		"UPDATE whiteboards SET status='archived', revision=revision+1 WHERE id=?1 AND revision=?2",
	)
		.bind(board.id, body.revision)
		.run();
	if (!result.meta.changes)
		return json({ error: "Whiteboard changed. Refresh before deleting." }, 409);
	await recordActivity(context, {
		userId: context.data.user.id,
		eventType: "whiteboard_deleted",
		path: "/whiteboards/",
	});
	return json({ ok: true });
}
