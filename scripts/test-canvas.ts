import assert from "node:assert/strict";
import { test } from "node:test";
import { Autosave, memoryAdapter } from "../src/canvas/adapters";
import { edgePath } from "../src/canvas/geometry";
import {
	createEdge,
	createNode,
	emptyDocument,
	exportCanvas,
	migrateDocument,
	safeUrl,
} from "../src/canvas/model";
import { CanvasStore } from "../src/canvas/store";

test("JSON Canvas migration and unknown fields survive round trips", () => {
	const imported = migrateDocument({
		custom: 4,
		nodes: [
			{
				id: "n",
				type: "text",
				text: "hello",
				x: 0,
				y: 0,
				width: 200,
				height: 100,
				future: { value: 1 },
			},
		],
		edges: [],
	});
	const again = migrateDocument(
		JSON.parse(JSON.stringify(exportCanvas(imported))),
	);
	assert.equal(again.nodes[0].data.text, "hello");
	assert.deepEqual(again.nodes[0].future, { value: 1 });
	assert.equal(again.custom, 4);
	assert.throws(() => migrateDocument({ version: 100 }));
	assert.throws(() =>
		migrateDocument({ nodes: [{ id: "same" }, { id: "same" }] }),
	);
});
test("node creation, editing, deletion, undo and redo use entity patches", () => {
	const store = new CanvasStore(emptyDocument());
	const n = createNode("text", 0, 0);
	store.updateNodes([n]);
	store.updateNodes([{ ...n, data: { ...n.data, text: "updated" } }]);
	assert.equal(store.nodes.get(n.id)?.data.text, "updated");
	store.undo();
	assert.equal(store.nodes.get(n.id)?.data.text, "");
	store.redo();
	store.remove([n.id]);
	assert.equal(store.nodes.size, 0);
	store.undo();
	assert.equal(store.nodes.size, 1);
});
test("edges, reverse and delete cascades", () => {
	const store = new CanvasStore(emptyDocument());
	const a = createNode("text", 0, 0);
	const b = createNode("text", 400, 0);
	store.updateNodes([a, b]);
	const e = createEdge(a.id, b.id);
	store.updateEdges([e]);
	store.updateEdges([{ ...e, fromNode: e.toNode, toNode: e.fromNode }]);
	assert.equal(store.edges.get(e.id)?.fromNode, b.id);
	store.remove([a.id]);
	assert.equal(store.edges.size, 0);
	store.undo();
	assert.equal(store.edges.size, 1);
	assert.ok(edgePath(e, a, b).path.startsWith("M"));
});
test("group collapse reroutes connections and copy remaps all IDs", () => {
	const store = new CanvasStore(emptyDocument());
	const a = createNode("text", 0, 0);
	const b = createNode("text", 400, 0);
	store.updateNodes([a, b]);
	store.updateEdges([createEdge(a.id, b.id)]);
	const groupId = store.group([a.id, b.id]) as string;
	const group = store.nodes.get(groupId);
	assert.ok(group);
	store.updateNodes([{ ...group, data: { ...group.data, collapsed: true } }]);
	assert.equal(store.displayNode(a.id)?.id, groupId);
	const pasted = store.paste(store.copy([groupId]));
	assert.equal(pasted.length, 3);
	assert.equal(store.edges.size, 2);
	assert.equal(new Set(store.nodes.keys()).size, 6);
});
test("autosave serializes requests and drains changes made during a save", async () => {
	const doc = emptyDocument();
	const adapter = memoryAdapter(doc);
	let saves = 0;
	let release: (() => void) | undefined;
	const controller = new Autosave(
		doc.id,
		1,
		() => doc,
		async (id, snapshot, revision) => {
			saves++;
			if (saves === 1)
				await new Promise<void>((r) => {
					release = r;
				});
			return adapter.saveDocument(id, snapshot, revision);
		},
		() => {},
		100000,
	);
	controller.change();
	const pending = controller.flush();
	controller.change();
	release?.();
	await pending;
	assert.equal(saves, 2);
	assert.equal(controller.revision, 3);
	assert.equal(controller.dirty, false);
	controller.destroy();
});
test("failed saves stay dirty and can retry; revision conflicts reject writes", async () => {
	const doc = emptyDocument();
	const adapter = memoryAdapter(doc);
	await adapter.saveDocument(doc.id, doc, 1);
	await assert.rejects(adapter.saveDocument(doc.id, doc, 1), /newer revision/u);
	let fail = true;
	const controller = new Autosave(
		doc.id,
		2,
		() => doc,
		async (id, snapshot, revision) => {
			if (fail) throw new Error("offline");
			return adapter.saveDocument(id, snapshot, revision);
		},
		() => {},
		100000,
	);
	controller.change();
	await controller.flush();
	assert.equal(controller.dirty, true);
	fail = false;
	controller.retry();
	await controller.flush();
	assert.equal(controller.dirty, false);
	controller.destroy();
});
test("malicious URLs and cyclic parents are rejected", () => {
	for (const url of [
		"javascript:alert(1)",
		"data:text/html,hello",
		"//evil.example",
		"/\\evil.example",
	])
		assert.equal(safeUrl(url), "");
	assert.equal(safeUrl("https://example.com"), "https://example.com/");
	const doc = emptyDocument();
	const group = createNode("group", 0, 0);
	group.parentId = group.id;
	doc.nodes.push(group);
	assert.throws(() => migrateDocument(doc), /Circular/u);
});
