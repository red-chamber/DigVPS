<script lang="ts">
import { onMount } from "svelte";
import type { CanvasMetadata } from "../../canvas/adapters";
import { whiteboardApiAdapter } from "../../canvas/api-adapter";
import { emptyDocument } from "../../canvas/model";

interface BoardSummary extends CanvasMetadata {
	id: string;
	revision: number;
	createdAt: number;
	updatedAt: number;
	canEdit: boolean;
}

let boards: BoardSummary[] = [];
let canCreate = false;
let loading = true;
let creating = false;
let error = "";
let formOpen = false;
let metadata: CanvasMetadata = {
	slug: "",
	title: "",
	description: "",
	category: "Whiteboard",
	tags: [],
};
const adapter = whiteboardApiAdapter();

function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\u4e00-\u9fff]+/gu, "-")
		.replace(/^-+|-+$/gu, "")
		.slice(0, 80);
}

async function load(): Promise<void> {
	loading = true;
	try {
		const response = await fetch("/api/whiteboards", { cache: "no-store" });
		const body = await response.json();
		if (!response.ok)
			throw new Error(body.error || "Whiteboards could not be loaded.");
		boards = body.boards || [];
		canCreate = Boolean(body.canCreate);
	} catch (cause) {
		error =
			cause instanceof Error
				? cause.message
				: "Whiteboards could not be loaded.";
	} finally {
		loading = false;
	}
}

async function create(): Promise<void> {
	if (!adapter.createDocument) return;
	error = "";
	creating = true;
	try {
		const finalMetadata = {
			...metadata,
			slug: metadata.slug || slugify(metadata.title),
		};
		const document = emptyDocument(undefined, finalMetadata.title);
		const id = await adapter.createDocument(document, finalMetadata);
		location.href = `/whiteboards/edit/?id=${encodeURIComponent(id)}`;
	} catch (cause) {
		error =
			cause instanceof Error
				? cause.message
				: "Whiteboard could not be created.";
		creating = false;
	}
}

async function remove(board: BoardSummary): Promise<void> {
	if (
		!confirm(
			`Delete “${board.title}”? Attachments will no longer be available.`,
		)
	)
		return;
	try {
		const response = await fetch("/api/whiteboards", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: board.id, revision: board.revision }),
		});
		const body = await response.json();
		if (!response.ok) throw new Error(body.error || "Delete failed.");
		boards = boards.filter((item) => item.id !== board.id);
	} catch (cause) {
		error = cause instanceof Error ? cause.message : "Delete failed.";
	}
}

onMount(load);
</script>

<section class="directory card-base">
	<header class="heading">
		<div>
			<p class="eyebrow">Knowledge canvas</p>
			<h1>Whiteboards</h1>
			<p>Arrange notes, links, images and ideas across an infinite canvas.</p>
		</div>
		{#if canCreate}<button class="primary" on:click={() => formOpen = !formOpen}>{formOpen ? "Cancel" : "New whiteboard"}</button>{/if}
	</header>

	{#if formOpen}
		<form class="create-form" on:submit|preventDefault={create}>
			<label>Title<input required maxlength="120" bind:value={metadata.title} on:input={() => { if (!metadata.slug) metadata.slug = slugify(metadata.title); }} /></label>
			<label>Slug<input required maxlength="80" pattern="[a-z0-9\u4e00-\u9fff][a-z0-9\u4e00-\u9fff-]*" bind:value={metadata.slug} /></label>
			<label class="wide">Short introduction<textarea required maxlength="240" bind:value={metadata.description}></textarea></label>
			<label>Category<input required maxlength="60" bind:value={metadata.category} /></label>
			<label>Tags<input placeholder="research, graph, study" on:input={(event) => metadata.tags = event.currentTarget.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12)} /></label>
			<div class="wide actions"><button class="primary" disabled={creating}>{creating ? "Creating…" : "Create and open"}</button></div>
		</form>
	{/if}

	{#if error}<div class="notice" role="alert">{error}</div>{/if}
	{#if loading}
		<p class="empty">Loading whiteboards…</p>
	{:else if boards.length === 0}
		<div class="empty"><strong>No whiteboards yet.</strong><span>{canCreate ? "Create the first one when an idea needs more room." : "Sign in to create one."}</span></div>
	{:else}
		<div class="boards">
			{#each boards as board (board.id)}
				<article class="board-card">
					<div class="preview" aria-hidden="true"><span></span><span></span><i></i></div>
					<div class="content">
						<p class="meta"><span>{board.category}</span><time datetime={new Date(board.updatedAt * 1000).toISOString()}>{new Date(board.updatedAt * 1000).toLocaleDateString()}</time></p>
						<h2><a data-no-swup href={`/whiteboards/edit/?id=${encodeURIComponent(board.id)}`}>{board.title}</a></h2>
						<p>{board.description}</p>
						<div class="tags">{#each board.tags as tag}<span>#{tag}</span>{/each}</div>
						<div class="card-actions"><a data-no-swup class="open" href={`/whiteboards/edit/?id=${encodeURIComponent(board.id)}`}>{board.canEdit ? "Open editor" : "View canvas"} →</a>{#if board.canEdit}<button on:click={() => remove(board)}>Delete</button>{/if}</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.directory { padding: 26px; color: var(--primary); }
	.heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding-bottom: 22px; border-bottom: 1px solid var(--line-divider); }
	.heading h1 { margin: 2px 0 5px; font: 700 2rem/1.1 serif; }
	.heading p { margin: 0; color: var(--meta-divider); }
	.eyebrow { color: var(--primary) !important; text-transform: uppercase; letter-spacing: .14em; font-size: 11px; font-weight: 800; }
	.primary { border: 0; border-radius: 10px; padding: 10px 15px; background: var(--primary); color: white; font-weight: 700; cursor: pointer; white-space: nowrap; }
	.primary:disabled { opacity: .55; }
	.create-form { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 20px 0; border-bottom: 1px solid var(--line-divider); }
	.create-form label { display: grid; gap: 5px; color: var(--meta-divider); font-size: 12px; font-weight: 700; }
	.create-form input, .create-form textarea { box-sizing: border-box; width: 100%; border: 1px solid var(--line-divider); border-radius: 9px; padding: 9px 10px; background: color-mix(in srgb, var(--card-bg) 90%, white); color: var(--primary); font: inherit; }
	.create-form textarea { min-height: 75px; resize: vertical; }
	.wide { grid-column: 1 / -1; }
	.actions { display: flex; justify-content: flex-end; }
	.notice { margin: 16px 0; padding: 10px 12px; border-radius: 8px; background: #ffe8e8; color: #9b2330; }
	.boards { display: grid; gap: 15px; padding-top: 20px; }
	.board-card { display: grid; grid-template-columns: 150px 1fr; overflow: hidden; border: 1px solid var(--line-divider); border-radius: 14px; background: color-mix(in srgb, var(--card-bg) 82%, transparent); transition: transform .18s, border-color .18s; }
	.board-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--primary) 35%, var(--line-divider)); }
	.preview { position: relative; min-height: 170px; overflow: hidden; background-image: radial-gradient(circle, #82aeb5 1px, transparent 1.2px); background-size: 14px 14px; background-color: #eaf4f5; }
	.preview span { position: absolute; width: 62px; height: 40px; border: 2px solid #63a1aa; border-radius: 7px; background: #f8ffff; }
	.preview span:first-child { left: 18px; top: 36px; }
	.preview span:nth-child(2) { right: 15px; bottom: 34px; }
	.preview i { position: absolute; left: 68px; top: 74px; width: 60px; height: 2px; background: #63a1aa; transform: rotate(28deg); transform-origin: left; }
	.content { min-width: 0; padding: 16px 18px; }
	.meta { display: flex; justify-content: space-between; gap: 10px; margin: 0; color: var(--meta-divider); font-size: 12px; }
	.content h2 { margin: 6px 0; font-size: 19px; }
	.content h2 a { color: var(--primary); text-decoration: none; }
	.content > p:not(.meta) { margin: 0; color: var(--meta-divider); }
	.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; color: var(--primary); font-size: 12px; }
	.card-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
	.open { color: var(--primary); font-weight: 700; text-decoration: none; }
	.card-actions button { border: 0; background: transparent; color: #a52c39; cursor: pointer; }
	.empty { display: grid; justify-items: center; gap: 5px; padding: 65px 15px; color: var(--meta-divider); text-align: center; }
	@media (max-width: 640px) { .directory { padding: 19px; } .heading { display: grid; } .create-form { grid-template-columns: 1fr; } .wide { grid-column: auto; } .board-card { grid-template-columns: 1fr; } .preview { min-height: 120px; } }
</style>
