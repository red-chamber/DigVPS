<script lang="ts">
import { onMount } from "svelte";
import {
	Autosave,
	type CanvasAdapter,
	type CanvasMetadata,
} from "../../canvas/adapters";
import { whiteboardApiAdapter } from "../../canvas/api-adapter";
import { download } from "../../canvas/dom";
import { exportVisual } from "../../canvas/export";
import { bounds, edgePath, intersects, visualBox } from "../../canvas/geometry";
import {
	type CanvasDocument,
	type CanvasEdge,
	type CanvasNode,
	clamp,
	createEdge,
	createNode,
	emptyDocument,
	exportCanvas,
	migrateDocument,
	type NodeType,
	safeUrl,
	type Viewport,
} from "../../canvas/model";
import { CanvasStore } from "../../canvas/store";

export let documentId = "";
export let readOnly = false;
export let adapter: CanvasAdapter = whiteboardApiAdapter();
export let initialDocument: CanvasDocument | undefined = undefined;

let root: HTMLDivElement;
let viewportElement: HTMLDivElement;
let fileInput: HTMLInputElement;
let store: CanvasStore | undefined;
let autosave: Autosave | undefined;
let markdownRenderer: ((source: string) => string) | undefined;
let nodes: CanvasNode[] = [];
let edges: CanvasEdge[] = [];
let viewport: Viewport = { x: 0, y: 0, zoom: 1 };
let selected = new Set<string>();
let selectedEdges = new Set<string>();
let editingId = "";
let status = "Loading…";
let error = "";
let loading = true;
let effectiveReadOnly = readOnly;
let mode: "select" | "pan" | "connect" = "select";
let metadata: CanvasMetadata = {
	slug: "",
	title: "Untitled whiteboard",
	description: "",
	category: "Whiteboard",
	tags: [],
};
let metadataOpen = false;
let settingsOpen = false;
let commandOpen = false;
let commandQuery = "";
let searchOpen = false;
let searchQuery = "";
let searchIndex = 0;
let focusMode = false;
let clipboard: { nodes: CanvasNode[]; edges: CanvasEdge[] } | undefined;
let contextMenu:
	| { x: number; y: number; canvasX: number; canvasY: number }
	| undefined;
let marquee:
	| { startX: number; startY: number; x: number; y: number }
	| undefined;
let connection:
	| { from: string; x: number; y: number; pointerX: number; pointerY: number }
	| undefined;
let stageWidth = 1200;
let stageHeight = 700;
let dragState:
	| {
			kind: "nodes" | "pan" | "resize";
			startX: number;
			startY: number;
			originalViewport?: Viewport;
			originalNodes?: Map<string, CanvasNode>;
			nodeId?: string;
	  }
	| undefined;

$: selectedNodes = nodes.filter((node) => selected.has(node.id));
$: selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : undefined;
$: selectedEdge = edges.find((edge) => selectedEdges.has(edge.id));
$: searchResults = searchQuery.trim()
	? nodes.filter((node) =>
			`${node.data.title} ${node.data.text}`
				.toLowerCase()
				.includes(searchQuery.trim().toLowerCase()),
		)
	: [];
$: visibleNodes = nodes.filter((node) => {
	const display = store?.displayNode(node.id);
	if (display?.id !== node.id) return false;
	const margin = 400 / viewport.zoom;
	return intersects(visualBox(node), {
		x: -viewport.x / viewport.zoom - margin,
		y: -viewport.y / viewport.zoom - margin,
		width: stageWidth / viewport.zoom + margin * 2,
		height: stageHeight / viewport.zoom + margin * 2,
	});
});
$: visibleIds = new Set(visibleNodes.map((node) => node.id));
$: visibleEdges = edges.filter((edge) => {
	const from = store?.displayNode(edge.fromNode);
	const to = store?.displayNode(edge.toNode);
	return Boolean(
		from &&
			to &&
			from.id !== to.id &&
			(visibleIds.has(from.id) || visibleIds.has(to.id)),
	);
});

function syncFromStore(): void {
	if (!store) return;
	nodes = [...store.nodes.values()];
	edges = [...store.edges.values()];
}

function snapshot(): CanvasDocument {
	if (!store) return emptyDocument(documentId, metadata.title);
	store.document.viewport = viewport;
	store.document.title = metadata.title;
	return store.snapshot();
}

function markChanged(): void {
	if (!effectiveReadOnly) autosave?.change();
}

function canvasPoint(clientX: number, clientY: number) {
	const rect = viewportElement.getBoundingClientRect();
	return {
		x: (clientX - rect.left - viewport.x) / viewport.zoom,
		y: (clientY - rect.top - viewport.y) / viewport.zoom,
	};
}

function snapped(value: number): number {
	const size = store?.document.settings.gridSize || 20;
	return store?.document.settings.snap
		? Math.round(value / size) * size
		: value;
}

function addNode(
	type: NodeType,
	point?: { x: number; y: number },
): CanvasNode | undefined {
	if (!store || effectiveReadOnly) return;
	const center =
		point ||
		canvasPoint(
			viewportElement.getBoundingClientRect().left + stageWidth / 2,
			viewportElement.getBoundingClientRect().top + stageHeight / 2,
		);
	const node = createNode(
		type,
		snapped(center.x - 140),
		snapped(center.y - 90),
		store.document.settings,
	);
	if (type === "markdown") node.data.text = "# New idea\n\nStart writing here.";
	if (type === "text") node.data.text = "New text";
	if (type === "link")
		node.data = { title: "Web link", text: "", url: "https://" };
	if (type === "portal")
		node.data = { title: "Whiteboard portal", text: "", documentId: "" };
	store.updateNodes([node], `Create ${type}`);
	selected = new Set([node.id]);
	selectedEdges = new Set();
	if (type === "text" || type === "markdown") editingId = node.id;
	return node;
}

function updateNode(node: CanvasNode, label = "Edit node"): void {
	store?.updateNodes([node], label);
}

function removeSelection(): void {
	if (!store || effectiveReadOnly) return;
	if (selected.size) store.remove(selected);
	if (selectedEdges.size) {
		store.commit(
			edges
				.filter((edge) => selectedEdges.has(edge.id))
				.map((edge) => ({ kind: "edge", id: edge.id, before: edge })),
			"Delete connections",
		);
	}
	selected = new Set();
	selectedEdges = new Set();
}

function selectNode(event: PointerEvent | MouseEvent, node: CanvasNode): void {
	if (event.shiftKey) {
		const next = new Set(selected);
		if (next.has(node.id)) next.delete(node.id);
		else next.add(node.id);
		selected = next;
	} else if (!selected.has(node.id)) {
		selected = new Set([node.id]);
	}
	selectedEdges = new Set();
}

function beginNodeDrag(event: PointerEvent, node: CanvasNode): void {
	if (editingId || node.locked || effectiveReadOnly || mode === "connect")
		return;
	selectNode(event, node);
	const ids =
		store?.descendants(selected.has(node.id) ? selected : new Set([node.id])) ||
		new Set([node.id]);
	dragState = {
		kind: "nodes",
		startX: event.clientX,
		startY: event.clientY,
		originalNodes: new Map(
			nodes.filter((item) => ids.has(item.id)).map((item) => [item.id, item]),
		),
	};
	event.preventDefault();
}

function beginResize(event: PointerEvent, node: CanvasNode): void {
	if (effectiveReadOnly || node.locked) return;
	dragState = {
		kind: "resize",
		startX: event.clientX,
		startY: event.clientY,
		originalNodes: new Map([[node.id, node]]),
		nodeId: node.id,
	};
	event.stopPropagation();
	event.preventDefault();
}

function beginConnection(event: PointerEvent, node: CanvasNode): void {
	if (effectiveReadOnly) return;
	const center = { x: node.x + node.width, y: node.y + node.height / 2 };
	connection = {
		from: node.id,
		...center,
		pointerX: center.x,
		pointerY: center.y,
	};
	event.stopPropagation();
	event.preventDefault();
}

function onCanvasPointerDown(event: PointerEvent): void {
	contextMenu = undefined;
	if (event.button === 1 || mode === "pan" || event.pointerType === "touch") {
		dragState = {
			kind: "pan",
			startX: event.clientX,
			startY: event.clientY,
			originalViewport: { ...viewport },
		};
		event.preventDefault();
		return;
	}
	if (event.button !== 0) return;
	const point = canvasPoint(event.clientX, event.clientY);
	marquee = { startX: point.x, startY: point.y, x: point.x, y: point.y };
	if (!event.shiftKey) {
		selected = new Set();
		selectedEdges = new Set();
	}
}

function onPointerMove(event: PointerEvent): void {
	if (connection) {
		const point = canvasPoint(event.clientX, event.clientY);
		connection = { ...connection, pointerX: point.x, pointerY: point.y };
		return;
	}
	if (marquee) {
		const point = canvasPoint(event.clientX, event.clientY);
		marquee = { ...marquee, x: point.x, y: point.y };
		return;
	}
	if (!dragState) return;
	if (dragState.kind === "pan" && dragState.originalViewport) {
		viewport = {
			...viewport,
			x: dragState.originalViewport.x + event.clientX - dragState.startX,
			y: dragState.originalViewport.y + event.clientY - dragState.startY,
		};
		return;
	}
	const dx = (event.clientX - dragState.startX) / viewport.zoom;
	const dy = (event.clientY - dragState.startY) / viewport.zoom;
	if (dragState.kind === "nodes" && dragState.originalNodes) {
		const moved = new Map(
			[...dragState.originalNodes].map(([id, node]) => [
				id,
				{ ...node, x: snapped(node.x + dx), y: snapped(node.y + dy) },
			]),
		);
		nodes = nodes.map((node) => moved.get(node.id) || node);
	} else if (dragState.kind === "resize" && dragState.originalNodes) {
		const original = dragState.originalNodes.get(dragState.nodeId || "");
		if (!original) return;
		let width = clamp(original.width + dx, 100, 3000);
		let height = clamp(original.height + dy, 70, 5000);
		if (original.aspectRatio)
			height = width / (original.width / original.height);
		nodes = nodes.map((node) =>
			node.id === original.id
				? { ...node, width: snapped(width), height: snapped(height) }
				: node,
		);
	}
}

function onPointerUp(event: PointerEvent): void {
	if (connection && store) {
		const target = document
			.elementFromPoint(event.clientX, event.clientY)
			?.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
		if (target && target !== connection.from)
			store.updateEdges(
				[createEdge(connection.from, target)],
				"Create connection",
			);
		connection = undefined;
	}
	if (marquee) {
		const area = {
			x: Math.min(marquee.startX, marquee.x),
			y: Math.min(marquee.startY, marquee.y),
			width: Math.abs(marquee.x - marquee.startX),
			height: Math.abs(marquee.y - marquee.startY),
		};
		if (area.width > 4 || area.height > 4) {
			const next = new Set(selected);
			for (const node of nodes)
				if (intersects(visualBox(node), area)) next.add(node.id);
			selected = next;
		}
		marquee = undefined;
	}
	if (!dragState) return;
	if (dragState.kind === "nodes" || dragState.kind === "resize") {
		const changed = nodes.filter((node) =>
			dragState?.originalNodes?.has(node.id),
		);
		store?.updateNodes(
			changed,
			dragState.kind === "nodes" ? "Move nodes" : "Resize node",
		);
	} else if (dragState.kind === "pan") {
		markChanged();
	}
	dragState = undefined;
}

function onWheel(event: WheelEvent): void {
	event.preventDefault();
	const rect = viewportElement.getBoundingClientRect();
	const localX = event.clientX - rect.left;
	const localY = event.clientY - rect.top;
	const trackpadPan =
		!event.ctrlKey &&
		(Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < 45);
	if (trackpadPan) {
		viewport = {
			...viewport,
			x: viewport.x - event.deltaX,
			y: viewport.y - event.deltaY,
		};
	} else {
		const nextZoom = clamp(
			viewport.zoom * Math.exp(-event.deltaY * 0.0015),
			0.08,
			4,
		);
		const worldX = (localX - viewport.x) / viewport.zoom;
		const worldY = (localY - viewport.y) / viewport.zoom;
		viewport = {
			x: localX - worldX * nextZoom,
			y: localY - worldY * nextZoom,
			zoom: nextZoom,
		};
	}
	window.clearTimeout(wheelSaveTimer);
	wheelSaveTimer = window.setTimeout(markChanged, 300);
}
let wheelSaveTimer = 0;

function fit(nodeList: CanvasNode[]): void {
	if (!nodeList.length) {
		viewport = { x: stageWidth / 2, y: stageHeight / 2, zoom: 1 };
		return;
	}
	const box = bounds(nodeList.map(visualBox));
	const zoom = clamp(
		Math.min((stageWidth - 120) / box.width, (stageHeight - 120) / box.height),
		0.08,
		2,
	);
	viewport = {
		x: (stageWidth - box.width * zoom) / 2 - box.x * zoom,
		y: (stageHeight - box.height * zoom) / 2 - box.y * zoom,
		zoom,
	};
	markChanged();
}

function zoomTo(percent: number): void {
	const old = viewport.zoom;
	const zoom = clamp(percent, 0.08, 4);
	viewport = {
		x: stageWidth / 2 - ((stageWidth / 2 - viewport.x) / old) * zoom,
		y: stageHeight / 2 - ((stageHeight / 2 - viewport.y) / old) * zoom,
		zoom,
	};
	markChanged();
}

function editText(node: CanvasNode, value: string): void {
	let height = node.height;
	if (node.dynamicHeight)
		height = clamp(90 + value.split("\n").length * 22, 90, 1200);
	updateNode(
		{ ...node, height, data: { ...node.data, text: value } },
		"Edit content",
	);
	editingId = "";
}

function cloneSelected(dx = 40, dy = 40): void {
	if (!store || !selected.size || effectiveReadOnly) return;
	selected = new Set(store.paste(store.copy(selected), { x: dx, y: dy }));
}

function cloneDirection(direction: "left" | "right" | "up" | "down"): void {
	if (!selectedNodes.length) return;
	const box = bounds(selectedNodes.map(visualBox));
	cloneSelected(
		direction === "left"
			? -box.width - 40
			: direction === "right"
				? box.width + 40
				: 0,
		direction === "up"
			? -box.height - 40
			: direction === "down"
				? box.height + 40
				: 0,
	);
}

async function moveSelectionToWhiteboard(): Promise<void> {
	if (!store || !selected.size || !adapter.createDocument || effectiveReadOnly)
		return;
	const title = window
		.prompt("Title for the new whiteboard:", "Extracted ideas")
		?.trim();
	if (!title) return;
	const copied = store.copy(selected);
	const box = bounds(copied.nodes.map(visualBox));
	const document = emptyDocument(undefined, title);
	document.nodes = copied.nodes.map((node) => ({
		...node,
		x: node.x - box.x + 60,
		y: node.y - box.y + 60,
	}));
	document.edges = copied.edges;
	document.viewport = { x: 80, y: 80, zoom: 1 };
	const slugBase = title
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fff]+/gu, "-")
		.replace(/^-+|-+$/gu, "")
		.slice(0, 60);
	status = "Creating nested whiteboard…";
	try {
		const targetId = await adapter.createDocument(document, {
			slug: `${slugBase || "whiteboard"}-${Date.now().toString(36)}`,
			title,
			description: `Extracted from ${metadata.title}.`,
			category: metadata.category || "Whiteboard",
			tags: metadata.tags,
		});
		store.remove(selected);
		const portal = createNode("portal", box.x, box.y, store.document.settings);
		portal.width = Math.max(220, Math.min(360, box.width));
		portal.data = { title, text: "", documentId: targetId };
		store.updateNodes([portal], "Create portal");
		selected = new Set([portal.id]);
		status = autosave?.status || "Unsaved changes";
	} catch (cause) {
		status =
			cause instanceof Error ? cause.message : "Could not create whiteboard.";
	}
}

function groupSelected(): void {
	if (!store || effectiveReadOnly) return;
	const id = store.group(selected);
	if (id) selected = new Set([id]);
}

function ungroupSelected(): void {
	if (!store || effectiveReadOnly) return;
	const groups = selectedNodes.filter((node) => node.type === "group");
	const updates = nodes
		.filter((node) => groups.some((group) => node.parentId === group.id))
		.map((node) => ({ ...node, parentId: undefined }));
	store.updateNodes(updates, "Ungroup");
	store.remove(groups.map((group) => group.id));
}

function layer(delta: number): void {
	if (!selectedNodes.length) return;
	store?.updateNodes(
		selectedNodes.map((node) => ({ ...node, zIndex: node.zIndex + delta })),
		"Change layer",
	);
}

function reverseSelectedEdges(): void {
	const updates = edges
		.filter((edge) => selectedEdges.has(edge.id))
		.map((edge) => ({
			...edge,
			fromNode: edge.toNode,
			toNode: edge.fromNode,
			fromSide: edge.toSide,
			toSide: edge.fromSide,
			fromEnd: edge.toEnd,
			toEnd: edge.fromEnd,
		}));
	store?.updateEdges(updates, "Reverse connections");
}

function updateSelectedStyle(
	key: keyof CanvasNode["style"],
	value: string | number,
): void {
	if (!selectedNodes.length) return;
	store?.updateNodes(
		selectedNodes.map((node) => ({
			...node,
			style: { ...node.style, [key]: value },
		})),
		"Style nodes",
	);
}

function updateSelectedData(key: string, value: unknown): void {
	if (!selectedNode) return;
	if (
		key === "documentId" &&
		String(value).replace(/^slug:/u, "") === documentId.replace(/^slug:/u, "")
	) {
		error = "A portal cannot point to its own whiteboard.";
		return;
	}
	updateNode(
		{ ...selectedNode, data: { ...selectedNode.data, [key]: value } },
		"Edit node properties",
	);
}

function updateSelectedEdge(
	key: "routing" | "label" | "line" | "color" | "width",
	value: string | number,
): void {
	if (!selectedEdge) return;
	const next = ["line", "color", "width"].includes(key)
		? { ...selectedEdge, style: { ...selectedEdge.style, [key]: value } }
		: { ...selectedEdge, [key]: value };
	store?.updateEdges([next as CanvasEdge], "Edit connection");
}

function flipSelection(axis: "horizontal" | "vertical"): void {
	if (selectedNodes.length < 2) return;
	const box = bounds(selectedNodes.map(visualBox));
	store?.updateNodes(
		selectedNodes.map((node) => ({
			...node,
			x:
				axis === "horizontal"
					? box.x + box.width - (node.x - box.x) - node.width
					: node.x,
			y:
				axis === "vertical"
					? box.y + box.height - (node.y - box.y) - node.height
					: node.y,
		})),
		`Flip ${axis}`,
	);
}

function swapSelected(): void {
	if (selectedNodes.length !== 2) return;
	const [first, second] = selectedNodes;
	store?.updateNodes(
		[
			{
				...first,
				x: second.x,
				y: second.y,
				width: second.width,
				height: second.height,
			},
			{
				...second,
				x: first.x,
				y: first.y,
				width: first.width,
				height: first.height,
			},
		],
		"Swap nodes",
	);
}

function toggleGroup(node: CanvasNode): void {
	updateNode(
		{ ...node, data: { ...node.data, collapsed: !node.data.collapsed } },
		"Toggle group",
	);
}

function exportJson(standard = false): void {
	const data = standard ? exportCanvas(snapshot()) : snapshot();
	download(
		`${metadata.slug || "whiteboard"}.${standard ? "canvas" : "json"}`,
		new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
	);
}

async function importFile(file: File): Promise<void> {
	if (!store || effectiveReadOnly) return;
	try {
		const imported = migrateDocument(JSON.parse(await file.text()));
		store = new CanvasStore({ ...imported, id: documentId });
		store.subscribe(() => {
			syncFromStore();
			markChanged();
		});
		viewport = imported.viewport;
		syncFromStore();
		markChanged();
	} catch (cause) {
		error = cause instanceof Error ? cause.message : "Import failed.";
	}
}

async function upload(
	file: File,
	point?: { x: number; y: number },
): Promise<void> {
	if (!adapter.uploadAsset || effectiveReadOnly) return;
	status = "Uploading…";
	try {
		const asset = await adapter.uploadAsset(documentId, file);
		const node = addNode(
			file.type.startsWith("image/") ? "image" : "file",
			point,
		);
		if (node)
			updateNode(
				{ ...node, data: { ...node.data, title: asset.name, url: asset.url } },
				"Attach file",
			);
		status = autosave?.status || "Saved";
	} catch (cause) {
		status = cause instanceof Error ? cause.message : "Upload failed.";
	}
}

function locateSearchResult(): void {
	if (!searchResults.length) return;
	searchIndex =
		((searchIndex % searchResults.length) + searchResults.length) %
		searchResults.length;
	const node = searchResults[searchIndex];
	selected = new Set([node.id]);
	fit([node]);
}

function onKeyDown(event: KeyboardEvent): void {
	const target = event.target as HTMLElement;
	if (target.matches("input, textarea, select") || target.isContentEditable)
		return;
	const mod = event.ctrlKey || event.metaKey;
	if (mod && event.key.toLowerCase() === "k") {
		event.preventDefault();
		commandOpen = true;
	} else if (mod && event.key.toLowerCase() === "f") {
		event.preventDefault();
		searchOpen = true;
	} else if (mod && event.key.toLowerCase() === "z") {
		event.preventDefault();
		event.shiftKey ? store?.redo() : store?.undo();
	} else if (mod && event.key.toLowerCase() === "y") {
		event.preventDefault();
		store?.redo();
	} else if (mod && event.key.toLowerCase() === "c") {
		clipboard = store?.copy(selected);
	} else if (mod && event.key.toLowerCase() === "x" && !effectiveReadOnly) {
		clipboard = store?.copy(selected);
		removeSelection();
	} else if (
		mod &&
		event.key.toLowerCase() === "v" &&
		clipboard &&
		!effectiveReadOnly
	) {
		event.preventDefault();
		selected = new Set(store?.paste(clipboard) || []);
	} else if (mod && event.key.toLowerCase() === "d") {
		event.preventDefault();
		cloneSelected();
	} else if (event.key === "Delete" || event.key === "Backspace") {
		event.preventDefault();
		removeSelection();
	} else if (event.key === "Escape") {
		editingId = "";
		commandOpen = false;
		contextMenu = undefined;
	} else if (
		["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) &&
		!effectiveReadOnly
	) {
		event.preventDefault();
		if (event.altKey) {
			cloneDirection(
				event.key.replace("Arrow", "").toLowerCase() as
					| "left"
					| "right"
					| "up"
					| "down",
			);
			return;
		}
		const amount = event.shiftKey ? 10 : 1;
		const dx =
			event.key === "ArrowLeft"
				? -amount
				: event.key === "ArrowRight"
					? amount
					: 0;
		const dy =
			event.key === "ArrowUp"
				? -amount
				: event.key === "ArrowDown"
					? amount
					: 0;
		store?.updateNodes(
			selectedNodes.map((node) => ({
				...node,
				x: node.x + dx,
				y: node.y + dy,
			})),
			"Nudge nodes",
		);
	}
}

function onPaste(event: ClipboardEvent): void {
	if (
		effectiveReadOnly ||
		(event.target as HTMLElement).matches("input, textarea")
	)
		return;
	const image = [...(event.clipboardData?.files || [])].find((file) =>
		file.type.startsWith("image/"),
	);
	if (image) {
		event.preventDefault();
		void upload(image);
		return;
	}
	const text = event.clipboardData?.getData("text/plain").trim();
	if (text && !clipboard) {
		event.preventDefault();
		const node = addNode("text");
		if (node)
			updateNode({ ...node, data: { ...node.data, text } }, "Paste text");
	}
}

function command(label: string, action: () => void, keywords = "") {
	return { label, action, keywords };
}
$: commands = [
	command("Create Markdown node", () => addNode("markdown"), "text note"),
	command("Create text node", () => addNode("text")),
	command("Create web link", () => addNode("link"), "url"),
	command("Create group", () => addNode("group")),
	command("Create portal", () => addNode("portal"), "nested canvas"),
	command("Fit all content", () => fit(nodes), "zoom"),
	command("Fit selection", () => fit(selectedNodes), "zoom"),
	command("Group selection", groupSelected),
	command(
		"Move selection to a new whiteboard",
		() => void moveSelectionToWhiteboard(),
		"portal extract",
	),
	command("Clone selection left", () => cloneDirection("left"), "duplicate"),
	command("Clone selection right", () => cloneDirection("right"), "duplicate"),
	command("Clone selection up", () => cloneDirection("up"), "duplicate"),
	command("Clone selection down", () => cloneDirection("down"), "duplicate"),
	command("Export JSON Canvas", () => exportJson(true), "canvas"),
];
$: filteredCommands = commands.filter((item) =>
	`${item.label} ${item.keywords}`
		.toLowerCase()
		.includes(commandQuery.toLowerCase()),
);

onMount(() => {
	void import("../../canvas/markdown").then(({ renderCanvasMarkdown }) => {
		markdownRenderer = renderCanvasMarkdown;
	});
	const params = new URLSearchParams(location.search);
	documentId =
		documentId ||
		params.get("id") ||
		(params.get("slug") ? `slug:${params.get("slug")}` : "");
	const observer = new ResizeObserver(([entry]) => {
		stageWidth = entry.contentRect.width;
		stageHeight = entry.contentRect.height;
	});
	observer.observe(viewportElement);
	window.addEventListener("pointermove", onPointerMove);
	window.addEventListener("pointerup", onPointerUp);
	window.addEventListener("keydown", onKeyDown);
	root.addEventListener("paste", onPaste);
	const beforeUnload = (event: BeforeUnloadEvent) => {
		if (autosave?.dirty) event.preventDefault();
	};
	window.addEventListener("beforeunload", beforeUnload);
	void (async () => {
		try {
			const loaded = initialDocument
				? { document: initialDocument, revision: 0, readOnly }
				: await adapter.loadDocument(documentId);
			store = new CanvasStore(loaded.document);
			viewport = loaded.document.viewport;
			metadata = loaded.metadata || {
				...metadata,
				title: loaded.document.title,
			};
			effectiveReadOnly = readOnly || Boolean(loaded.readOnly);
			store.subscribe(() => {
				syncFromStore();
				markChanged();
			});
			if (!effectiveReadOnly)
				autosave = new Autosave(
					documentId,
					loaded.revision,
					snapshot,
					adapter.saveDocument,
					(value) => {
						status = value;
					},
					1100,
					() => metadata,
				);
			syncFromStore();
			status = effectiveReadOnly ? "Read only" : "Saved";
		} catch (cause) {
			error =
				cause instanceof Error
					? cause.message
					: "Whiteboard could not be loaded.";
		} finally {
			loading = false;
		}
	})();
	return () => {
		observer.disconnect();
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("keydown", onKeyDown);
		window.removeEventListener("beforeunload", beforeUnload);
		root.removeEventListener("paste", onPaste);
		void autosave?.flush();
		autosave?.destroy();
	};
});
</script>

<div class:dark={store?.document.settings.theme === "dark"} class="canvas-editor" bind:this={root} tabindex="-1">
	<header class="toolbar" aria-label="Whiteboard toolbar">
		<a class="tool brand" href="/whiteboards/" title="All whiteboards">← <span>Whiteboards</span></a>
		<div class="separator"></div>
		<button class:active={mode === "select"} class="tool" on:click={() => mode = "select"} title="Select (V)" aria-label="Select">↖</button>
		<button class:active={mode === "pan"} class="tool" on:click={() => mode = "pan"} title="Pan canvas" aria-label="Pan">✋</button>
		{#if !effectiveReadOnly}
			<button class="tool" on:click={() => addNode("markdown")} title="Markdown node" aria-label="Add Markdown">M↓</button>
			<button class="tool" on:click={() => addNode("text")} title="Text node" aria-label="Add text">T</button>
			<button class="tool" on:click={() => addNode("link")} title="Web link" aria-label="Add web link">🔗</button>
			<button class="tool" on:click={() => fileInput.click()} title="Upload image or file" aria-label="Upload">＋</button>
			<input class="hidden-input" bind:this={fileInput} type="file" on:change={(event) => { const file = event.currentTarget.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} />
		{/if}
		<div class="separator"></div>
		<button class="tool" disabled={!store?.canUndo || effectiveReadOnly} on:click={() => store?.undo()} title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>
		<button class="tool" disabled={!store?.canRedo || effectiveReadOnly} on:click={() => store?.redo()} title="Redo (Ctrl+Y)" aria-label="Redo">↷</button>
		<button class="tool" on:click={() => fit(nodes)} title="Fit all" aria-label="Fit all">⊡</button>
		<button class="tool zoom" on:click={() => zoomTo(1)} title="Reset zoom">{Math.round(viewport.zoom * 100)}%</button>
		<div class="toolbar-spacer"></div>
		<button class:active={searchOpen} class="tool" on:click={() => searchOpen = !searchOpen} title="Search (Ctrl+F)" aria-label="Search">⌕</button>
		<button class="tool" on:click={() => commandOpen = true} title="Command palette (Ctrl+K)" aria-label="Commands">⌘</button>
		<button class:active={metadataOpen} class="tool" on:click={() => metadataOpen = !metadataOpen} title="Document properties" aria-label="Properties">⚙</button>
		<span class:error-status={status !== "Saved" && status !== "Read only" && !status.includes("Saving")} class="save-status">{status}</span>
		{#if status !== "Saved" && status !== "Read only" && !status.includes("Saving") && autosave}
			<button class="retry" on:click={() => autosave?.retry()}>Retry</button>
		{/if}
	</header>

	{#if searchOpen}
		<div class="search-popover">
			<input bind:value={searchQuery} on:input={() => { searchIndex = 0; locateSearchResult(); }} placeholder="Search this whiteboard…" aria-label="Search whiteboard" />
			<span>{searchResults.length ? `${searchIndex + 1}/${searchResults.length}` : "0 results"}</span>
			<button on:click={() => { searchIndex--; locateSearchResult(); }} aria-label="Previous result">↑</button>
			<button on:click={() => { searchIndex++; locateSearchResult(); }} aria-label="Next result">↓</button>
		</div>
	{/if}

	{#if metadataOpen}
		<aside class="panel properties" aria-label="Whiteboard properties">
			<h2>Whiteboard properties</h2>
			<label>Title<input bind:value={metadata.title} disabled={effectiveReadOnly} on:change={markChanged} maxlength="120" /></label>
			<label>Slug<input bind:value={metadata.slug} disabled={effectiveReadOnly} on:change={markChanged} maxlength="80" /></label>
			<label>Introduction<textarea bind:value={metadata.description} disabled={effectiveReadOnly} on:change={markChanged} maxlength="240"></textarea></label>
			<label>Category<input bind:value={metadata.category} disabled={effectiveReadOnly} on:change={markChanged} maxlength="60" /></label>
			<label>Tags<input value={metadata.tags.join(", ")} disabled={effectiveReadOnly} on:change={(event) => { metadata.tags = event.currentTarget.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12); markChanged(); }} /></label>
			<details bind:open={settingsOpen}>
				<summary>Canvas settings</summary>
				<label class="inline"><input type="checkbox" checked={store?.document.settings.grid} disabled={effectiveReadOnly} on:change={(event) => { if (store) store.document.settings.grid = event.currentTarget.checked; markChanged(); }} /> Grid</label>
				<label class="inline"><input type="checkbox" checked={store?.document.settings.snap} disabled={effectiveReadOnly} on:change={(event) => { if (store) store.document.settings.snap = event.currentTarget.checked; markChanged(); }} /> Snap to grid</label>
				<label>Grid size<input type="number" min="5" max="200" value={store?.document.settings.gridSize || 20} disabled={effectiveReadOnly} on:change={(event) => { if (store) store.document.settings.gridSize = clamp(event.currentTarget.valueAsNumber, 5, 200); markChanged(); }} /></label>
				<label>Theme<select value={store?.document.settings.theme} disabled={effectiveReadOnly} on:change={(event) => { if (store) store.document.settings.theme = event.currentTarget.value as "light" | "dark"; markChanged(); }}><option value="light">Light</option><option value="dark">Dark</option></select></label>
			</details>
			<div class="panel-actions"><button on:click={() => exportJson(false)}>JSON</button><button on:click={() => exportJson(true)}>.canvas</button><button on:click={() => void exportVisual(snapshot(), selected, "png", false)}>PNG</button><button on:click={() => void exportVisual(snapshot(), selected, "svg", true)}>SVG</button></div>
			{#if !effectiveReadOnly}<label class="import">Import JSON/.canvas<input type="file" accept=".json,.canvas,application/json" on:change={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importFile(file); }} /></label>{/if}
		</aside>
	{/if}

	{#if selectedNode && !effectiveReadOnly && !metadataOpen}
		<aside class="panel inspector" aria-label="Selected node properties">
			<h2>Node properties</h2>
			<label>Type<select value={selectedNode.type} on:change={(event) => updateNode({ ...selectedNode, type: event.currentTarget.value as NodeType }, "Change node type")}><option value="text">Text</option><option value="markdown">Markdown</option><option value="image">Image</option><option value="file">File</option><option value="link">Web link</option><option value="group">Group</option><option value="portal">Portal</option></select></label>
			<label>Title<input value={selectedNode.data.title} maxlength="120" on:change={(event) => updateSelectedData("title", event.currentTarget.value)} /></label>
			{#if ["link", "image", "file"].includes(selectedNode.type)}<label>URL<input value={selectedNode.data.url || ""} on:change={(event) => updateSelectedData("url", event.currentTarget.value)} /></label>{/if}
			{#if selectedNode.type === "portal"}<label>Target whiteboard ID<input value={selectedNode.data.documentId || ""} on:change={(event) => updateSelectedData("documentId", event.currentTarget.value)} /></label>{/if}
			<div class="color-grid"><label>Background<input type="color" value={selectedNode.style.background} on:change={(event) => updateSelectedStyle("background", event.currentTarget.value)} /></label><label>Border<input type="color" value={selectedNode.style.border} on:change={(event) => updateSelectedStyle("border", event.currentTarget.value)} /></label><label>Text<input type="color" value={selectedNode.style.color} on:change={(event) => updateSelectedStyle("color", event.currentTarget.value)} /></label></div>
			<label>Shape<select value={selectedNode.style.shape} on:change={(event) => updateSelectedStyle("shape", event.currentTarget.value)}><option value="rounded">Rounded</option><option value="rectangle">Rectangle</option><option value="pill">Pill</option><option value="diamond">Diamond</option><option value="process">Process</option><option value="document">Document</option><option value="database">Database</option></select></label>
			<label>Border<select value={selectedNode.style.line} on:change={(event) => updateSelectedStyle("line", event.currentTarget.value)}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="hidden">Hidden</option></select></label>
			<label>Text alignment<select value={selectedNode.style.align} on:change={(event) => updateSelectedStyle("align", event.currentTarget.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
			<label>Opacity<input type="range" min="0.1" max="1" step="0.05" value={selectedNode.style.opacity} on:input={(event) => updateSelectedStyle("opacity", event.currentTarget.valueAsNumber)} /></label>
			<div class="checks"><label class="inline"><input type="checkbox" checked={selectedNode.dynamicHeight} on:change={(event) => updateNode({ ...selectedNode, dynamicHeight: event.currentTarget.checked }, "Toggle automatic height")} /> Automatic height</label><label class="inline"><input type="checkbox" checked={selectedNode.aspectRatio} on:change={(event) => updateNode({ ...selectedNode, aspectRatio: event.currentTarget.checked }, "Toggle aspect ratio")} /> Lock aspect ratio</label><label class="inline"><input type="checkbox" checked={selectedNode.locked} on:change={(event) => updateNode({ ...selectedNode, locked: event.currentTarget.checked }, "Toggle node lock")} /> Locked</label></div>
		</aside>
	{/if}

	{#if selectedEdge && !effectiveReadOnly && !metadataOpen}
		<aside class="panel inspector" aria-label="Selected connection properties">
			<h2>Connection properties</h2>
			<label>Label<input value={selectedEdge.label} on:change={(event) => updateSelectedEdge("label", event.currentTarget.value)} /></label>
			<label>Routing<select value={selectedEdge.routing} on:change={(event) => updateSelectedEdge("routing", event.currentTarget.value)}><option value="straight">Straight</option><option value="bezier">Bezier</option><option value="elbow">Elbow</option><option value="orthogonal">Orthogonal</option></select></label>
			<label>Line<select value={selectedEdge.style.line} on:change={(event) => updateSelectedEdge("line", event.currentTarget.value)}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>
			<label>Color<input type="color" value={selectedEdge.style.color} on:change={(event) => updateSelectedEdge("color", event.currentTarget.value)} /></label>
			<label>Width<input type="range" min="1" max="8" step="1" value={selectedEdge.style.width} on:input={(event) => updateSelectedEdge("width", event.currentTarget.valueAsNumber)} /></label>
			<div class="panel-actions"><button on:click={reverseSelectedEdges}>Reverse direction</button><button class="danger" on:click={removeSelection}>Delete</button></div>
		</aside>
	{/if}

	{#if selectedNodes.length && !effectiveReadOnly}
		<div class="selection-toolbar">
			<button on:click={() => cloneSelected()} title="Clone">Clone</button>
			<button on:click={groupSelected} disabled={selectedNodes.length < 2} title="Group selection">Group</button>
			<button on:click={ungroupSelected} title="Ungroup">Ungroup</button>
			<button on:click={() => void moveSelectionToWhiteboard()} title="Move selection to a new whiteboard and leave a portal">To board</button>
			<button on:click={() => layer(1)} title="Move one layer up">↑ layer</button>
			<button on:click={() => layer(-1)} title="Move one layer down">↓ layer</button>
			<button on:click={() => flipSelection("horizontal")} disabled={selectedNodes.length < 2} title="Flip horizontally">⇋</button>
			<button on:click={() => flipSelection("vertical")} disabled={selectedNodes.length < 2} title="Flip vertically">⇅</button>
			<button on:click={swapSelected} disabled={selectedNodes.length !== 2} title="Swap position and size">Swap</button>
			<input type="color" value={selectedNode?.style.background || "#f7fbfc"} on:change={(event) => updateSelectedStyle("background", event.currentTarget.value)} title="Background color" aria-label="Background color" />
			<button on:click={removeSelection} class="danger" title="Delete selection">Delete</button>
		</div>
	{/if}

	{#if selectedEdges.size && !effectiveReadOnly && metadataOpen}
		<div class="selection-toolbar"><button on:click={reverseSelectedEdges}>Reverse direction</button><button class="danger" on:click={removeSelection}>Delete connection</button></div>
	{/if}

	<div
		class:pan-mode={mode === "pan"}
		class="viewport"
		bind:this={viewportElement}
		on:pointerdown={onCanvasPointerDown}
		on:wheel={onWheel}
		on:dblclick={(event) => { if (event.target === viewportElement && !effectiveReadOnly) addNode("markdown", canvasPoint(event.clientX, event.clientY)); }}
		on:contextmenu={(event) => { event.preventDefault(); const point = canvasPoint(event.clientX, event.clientY); contextMenu = { x: event.clientX, y: event.clientY, canvasX: point.x, canvasY: point.y }; }}
		style:--grid-size={`${(store?.document.settings.gridSize || 20) * viewport.zoom}px`}
		style:--grid-x={`${viewport.x}px`}
		style:--grid-y={`${viewport.y}px`}
		class:grid={store?.document.settings.grid}
	>
		{#if loading}<div class="center-message">Loading whiteboard…</div>{/if}
		{#if error}<div class="center-message error"><strong>Whiteboard unavailable</strong><span>{error}</span><a href="/whiteboards/">Return to directory</a></div>{/if}
		<div class="world" style:transform={`translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`}>
			<svg class="edges" aria-label="Connections">
				<defs><marker id="canvas-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker></defs>
				{#each visibleEdges as edge (edge.id)}
					{@const from = store?.displayNode(edge.fromNode)}
					{@const to = store?.displayNode(edge.toNode)}
					{#if from && to && from.id !== to.id}
						{@const route = edgePath(edge, visualBox(from), visualBox(to), dragState ? [] : visibleNodes.filter((node) => node.id !== from.id && node.id !== to.id && node.type !== "group").map(visualBox))}
						<path class="edge-hit" d={route.path} on:pointerdown={(event) => { event.stopPropagation(); selectedEdges = new Set(event.shiftKey ? [...selectedEdges, edge.id] : [edge.id]); selected = new Set(); }} />
						<path class:selected-edge={selectedEdges.has(edge.id)} class="edge" d={route.path} stroke={edge.style.color} stroke-width={edge.style.width} stroke-dasharray={edge.style.line === "dashed" ? "9 6" : edge.style.line === "dotted" ? "2 5" : undefined} marker-start={edge.fromEnd === "arrow" ? "url(#canvas-arrow)" : undefined} marker-end={edge.toEnd === "arrow" ? "url(#canvas-arrow)" : undefined} />
						{#if edge.label}<text class="edge-label" x={route.label.x} y={route.label.y - 7}>{edge.label}</text>{/if}
					{/if}
				{/each}
				{#if connection}<path class="edge preview" d={`M${connection.x},${connection.y} L${connection.pointerX},${connection.pointerY}`} />{/if}
			</svg>

			{#each visibleNodes.sort((a, b) => a.zIndex - b.zIndex) as node (node.id)}
				<article
					class:selected={selected.has(node.id)}
					class:locked={node.locked}
					class:low-detail={viewport.zoom < (store?.document.settings.detailThreshold || 0.35)}
					class:dimmed={focusMode && !selected.has(node.id)}
					class:diamond={node.style.shape === "diamond"}
					class:pill={node.style.shape === "pill"}
					class:rectangle={node.style.shape === "rectangle"}
					class:group-node={node.type === "group"}
					class="canvas-node"
					data-node-id={node.id}
					style:left={`${node.x}px`}
					style:top={`${node.y}px`}
					style:width={`${node.width}px`}
					style:height={`${node.type === "group" && node.data.collapsed ? 70 : node.height}px`}
					style:background={node.style.background}
					style:border-color={node.style.line === "hidden" ? "transparent" : node.style.border}
					style:border-style={node.style.line === "hidden" ? "solid" : node.style.line}
					style:color={node.style.color}
					style:opacity={node.style.opacity}
					style:text-align={node.style.align}
					on:pointerdown={(event) => beginNodeDrag(event, node)}
					on:click={(event) => { if (!(event.target as HTMLElement).closest("a, button, textarea")) selectNode(event, node); }}
					on:dblclick={(event) => { event.stopPropagation(); if (!effectiveReadOnly && ["text", "markdown"].includes(node.type)) editingId = node.id; }}
					on:contextmenu={(event) => { event.preventDefault(); event.stopPropagation(); selected = new Set([node.id]); const point = canvasPoint(event.clientX, event.clientY); contextMenu = { x: event.clientX, y: event.clientY, canvasX: point.x, canvasY: point.y }; }}
				>
					<header class="node-title">
						<span>{node.data.title || (node.type === "markdown" ? "Markdown" : node.type)}</span>
						{#if node.type === "group" && !effectiveReadOnly}<button on:pointerdown={(event) => event.stopPropagation()} on:click={() => toggleGroup(node)} aria-label={node.data.collapsed ? "Expand group" : "Collapse group"}>{node.data.collapsed ? "+" : "−"}</button>{/if}
					</header>
					{#if !(node.type === "group" && node.data.collapsed)}
						<div class="node-content">
							{#if editingId === node.id}
								<textarea autofocus value={node.data.text} on:pointerdown={(event) => event.stopPropagation()} on:keydown={(event) => { if (event.key === "Escape") { event.preventDefault(); editingId = ""; } }} on:blur={(event) => editText(node, event.currentTarget.value)}></textarea>
							{:else if node.type === "markdown"}
								{#if markdownRenderer}<div class="markdown">{@html markdownRenderer(node.data.text)}</div>{:else}<p>{node.data.text}</p>{/if}
							{:else if node.type === "image" && safeUrl(node.data.url || "")}
								<img loading="lazy" decoding="async" src={safeUrl(node.data.url || "")} alt={node.data.title || "Canvas asset"} />
							{:else if node.type === "link" && safeUrl(node.data.url || "")}
								<a href={safeUrl(node.data.url || "")} target="_blank" rel="noopener noreferrer" on:pointerdown={(event) => event.stopPropagation()}>{node.data.url}</a>
							{:else if node.type === "portal"}
								<a href={`/whiteboards/edit/?id=${encodeURIComponent(node.data.documentId || "")}`} on:pointerdown={(event) => event.stopPropagation()}>Open nested whiteboard →</a>
							{:else if node.type === "file"}
								<a href={safeUrl(node.data.url || "")} target="_blank" rel="noopener noreferrer" on:pointerdown={(event) => event.stopPropagation()}>Download {node.data.title || "attachment"}</a>
							{:else}<p>{node.data.text}</p>{/if}
						</div>
					{/if}
					{#if selected.has(node.id) && !effectiveReadOnly}
						<button class="connect-handle" on:pointerdown={(event) => beginConnection(event, node)} title="Drag to connect" aria-label="Connect node"></button>
						<button class="resize-handle" on:pointerdown={(event) => beginResize(event, node)} title="Resize" aria-label="Resize node"></button>
					{/if}
				</article>
			{/each}
			{#if marquee}<div class="marquee" style:left={`${Math.min(marquee.startX, marquee.x)}px`} style:top={`${Math.min(marquee.startY, marquee.y)}px`} style:width={`${Math.abs(marquee.x - marquee.startX)}px`} style:height={`${Math.abs(marquee.y - marquee.startY)}px`}></div>{/if}
		</div>

		{#if store?.document.settings.minimap && nodes.length}
			{@const mapBounds = bounds(nodes.map(visualBox))}
			<div class="minimap" aria-label="Whiteboard minimap">
				{#each nodes as node (node.id)}<span class:selected={selected.has(node.id)} style:left={`${((node.x - mapBounds.x) / Math.max(mapBounds.width, 1)) * 100}%`} style:top={`${((node.y - mapBounds.y) / Math.max(mapBounds.height, 1)) * 100}%`} style:width={`${Math.max(2, (node.width / Math.max(mapBounds.width, 1)) * 100)}%`} style:height={`${Math.max(2, (node.height / Math.max(mapBounds.height, 1)) * 100)}%`}></span>{/each}
			</div>
		{/if}
	</div>

	{#if contextMenu}
		<div class="context-menu" style:left={`${contextMenu.x}px`} style:top={`${contextMenu.y}px`}>
			{#if selected.size}
				<button on:click={() => { editingId = selectedNode?.id || ""; contextMenu = undefined; }} disabled={!selectedNode || !["text", "markdown"].includes(selectedNode.type)}>Edit</button>
				<button on:click={() => { cloneSelected(); contextMenu = undefined; }} disabled={effectiveReadOnly}>Clone</button>
				<button on:click={() => { focusMode = !focusMode; contextMenu = undefined; }}>{focusMode ? "Leave focus mode" : "Focus selection"}</button>
				<button on:click={() => { removeSelection(); contextMenu = undefined; }} disabled={effectiveReadOnly}>Delete</button>
			{:else}
				<button on:click={() => { addNode("markdown", { x: contextMenu?.canvasX || 0, y: contextMenu?.canvasY || 0 }); contextMenu = undefined; }} disabled={effectiveReadOnly}>New Markdown node</button>
				<button on:click={() => { addNode("text", { x: contextMenu?.canvasX || 0, y: contextMenu?.canvasY || 0 }); contextMenu = undefined; }} disabled={effectiveReadOnly}>New text node</button>
				<button on:click={() => { fit(nodes); contextMenu = undefined; }}>Fit all content</button>
			{/if}
		</div>
	{/if}

	{#if commandOpen}
		<div class="modal-backdrop" role="presentation" on:pointerdown={(event) => { if (event.target === event.currentTarget) commandOpen = false; }}>
			<div class="command-palette" role="dialog" aria-label="Command palette">
				<input autofocus bind:value={commandQuery} placeholder="Type a command…" aria-label="Search commands" />
				<div>{#each filteredCommands as item}<button on:click={() => { item.action(); commandOpen = false; commandQuery = ""; }} disabled={effectiveReadOnly && item.label.startsWith("Create")}>{item.label}</button>{/each}</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.canvas-editor { --surface: #f5fafb; --panel: rgba(255,255,255,.92); --ink: #18363c; --muted: #668087; --line: #c8d9dd; --accent: #168898; position: relative; width: 100%; height: 100%; min-height: 560px; overflow: hidden; background: var(--surface); color: var(--ink); font: 14px/1.45 Roboto, system-ui, sans-serif; }
	.canvas-editor.dark { --surface: #101d21; --panel: rgba(23,39,44,.94); --ink: #e8f4f5; --muted: #9ab0b5; --line: #3c555b; }
	.toolbar { position: absolute; inset: 10px 12px auto; z-index: 100; height: 46px; display: flex; align-items: center; gap: 4px; padding: 5px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); box-shadow: 0 8px 30px #173b421b; backdrop-filter: blur(16px); }
	.tool { display: grid; place-items: center; min-width: 34px; height: 34px; padding: 0 9px; border: 0; border-radius: 9px; color: var(--ink); background: transparent; cursor: pointer; text-decoration: none; font-weight: 650; }
	.tool:hover, .tool.active { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
	.tool:disabled { opacity: .35; cursor: default; }
	.tool.brand { display: flex; gap: 6px; }
	.tool.zoom { min-width: 58px; font-variant-numeric: tabular-nums; }
	.separator { width: 1px; height: 24px; background: var(--line); margin: 0 3px; }
	.toolbar-spacer { flex: 1; }
	.save-status { max-width: 210px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); padding: 0 8px; font-size: 12px; }
	.error-status { color: #a82a35; }
	.retry { border: 0; background: var(--accent); color: white; border-radius: 8px; padding: 6px 10px; }
	.hidden-input { display: none; }
	.viewport { position: absolute; inset: 0; overflow: hidden; touch-action: none; cursor: crosshair; background-color: var(--surface); }
	.viewport.grid { background-image: radial-gradient(circle, color-mix(in srgb, var(--muted) 38%, transparent) 1px, transparent 1.2px); background-size: var(--grid-size) var(--grid-size); background-position: var(--grid-x) var(--grid-y); }
	.viewport.pan-mode { cursor: grab; }
	.world { position: absolute; inset: 0 auto auto 0; width: 1px; height: 1px; transform-origin: 0 0; will-change: transform; }
	.edges { position: absolute; overflow: visible; width: 1px; height: 1px; pointer-events: none; }
	.edge { fill: none; pointer-events: none; vector-effect: non-scaling-stroke; }
	.edge.selected-edge { stroke: var(--accent) !important; filter: drop-shadow(0 0 3px color-mix(in srgb, var(--accent) 70%, transparent)); }
	.edge.preview { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 7 5; }
	.edge-hit { fill: none; stroke: transparent; stroke-width: 16; pointer-events: stroke; cursor: pointer; vector-effect: non-scaling-stroke; }
	.edge-label { fill: var(--ink); font-size: 13px; text-anchor: middle; paint-order: stroke; stroke: var(--surface); stroke-width: 4px; }
	.canvas-node { position: absolute; box-sizing: border-box; border-width: 2px; border-radius: 13px; box-shadow: 0 5px 20px #173b4215; overflow: visible; user-select: none; contain: layout paint style; transition: box-shadow .12s, opacity .16s; }
	.canvas-node.rectangle { border-radius: 0; }
	.canvas-node.pill { border-radius: 999px; }
	.canvas-node.diamond { transform: rotate(45deg) scale(.72); }
	.canvas-node.diamond > * { transform: rotate(-45deg) scale(1.38); }
	.canvas-node.group-node { background: color-mix(in srgb, var(--panel) 25%, transparent) !important; border-width: 2px; box-shadow: none; }
	.canvas-node.selected { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 50%, transparent), 0 8px 24px #173b4224; }
	.canvas-node.locked { cursor: not-allowed; }
	.canvas-node.dimmed { opacity: .16 !important; }
	.node-title { height: 34px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 11px; font-weight: 700; border-bottom: 1px solid color-mix(in srgb, currentColor 13%, transparent); overflow: hidden; }
	.node-title span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
	.node-title button { border: 0; background: transparent; color: inherit; font-size: 18px; }
	.node-content { height: calc(100% - 35px); padding: 10px 12px; overflow: auto; user-select: text; overflow-wrap: anywhere; }
	.node-content textarea { width: 100%; height: 100%; resize: none; border: 0; outline: 0; color: inherit; background: transparent; font: inherit; }
	.node-content img { width: 100%; height: 100%; object-fit: contain; }
	.node-content a { color: var(--accent); }
	.node-content p { margin: 0; white-space: pre-wrap; }
	.markdown :global(h1), .markdown :global(h2), .markdown :global(h3) { margin: .25em 0 .45em; line-height: 1.2; }
	.markdown :global(p) { margin: 0 0 .65em; }
	.markdown :global(pre) { overflow: auto; padding: 8px; border-radius: 7px; background: #102328; color: #eaf7f8; }
	.markdown :global(code) { font-family: "JetBrains Mono Variable", monospace; }
	.markdown :global(.hljs-keyword), .markdown :global(.hljs-selector-tag), .markdown :global(.hljs-built_in) { color: #70d7ff; }
	.markdown :global(.hljs-string), .markdown :global(.hljs-attr) { color: #b9e879; }
	.markdown :global(.hljs-number), .markdown :global(.hljs-literal) { color: #ffc777; }
	.markdown :global(.hljs-comment) { color: #7f9ca3; font-style: italic; }
	.markdown :global(.hljs-title), .markdown :global(.hljs-function) { color: #d5a6ff; }
	.markdown :global(table) { border-collapse: collapse; width: 100%; }
	.markdown :global(td), .markdown :global(th) { border: 1px solid var(--line); padding: 4px 6px; }
	.low-detail .node-content { display: none; }
	.low-detail .node-title { height: 100%; border: 0; justify-content: center; }
	.connect-handle, .resize-handle { position: absolute; z-index: 4; width: 14px; height: 14px; padding: 0; border: 2px solid white; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
	.connect-handle { right: -8px; top: calc(50% - 7px); cursor: crosshair; }
	.resize-handle { right: -8px; bottom: -8px; cursor: nwse-resize; border-radius: 3px; }
	.marquee { position: absolute; border: 1.5px solid var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); pointer-events: none; }
	.selection-toolbar { position: absolute; z-index: 110; top: 66px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; padding: 5px; border: 1px solid var(--line); border-radius: 11px; background: var(--panel); box-shadow: 0 8px 24px #173b421f; }
	.selection-toolbar button, .panel-actions button { border: 0; border-radius: 7px; padding: 6px 9px; background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--ink); cursor: pointer; }
	.selection-toolbar .danger { color: #a82a35; }
	.selection-toolbar input[type="color"] { width: 29px; height: 29px; border: 0; padding: 1px; background: transparent; }
	.panel { position: absolute; z-index: 120; top: 66px; right: 12px; width: min(320px, calc(100vw - 24px)); max-height: calc(100% - 80px); overflow: auto; padding: 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); box-shadow: 0 14px 40px #173b422b; backdrop-filter: blur(18px); }
	.panel.inspector { top: 115px; left: 12px; right: auto; width: min(280px, calc(100vw - 24px)); max-height: calc(100% - 130px); }
	.panel h2 { font-size: 16px; margin: 0 0 12px; }
	.panel label { display: grid; gap: 4px; margin: 10px 0; color: var(--muted); font-size: 12px; font-weight: 650; }
	.panel label.inline { display: flex; align-items: center; }
	.panel input, .panel textarea, .panel select, .search-popover input, .command-palette input { box-sizing: border-box; width: 100%; border: 1px solid var(--line); border-radius: 8px; padding: 8px 9px; background: color-mix(in srgb, var(--surface) 80%, transparent); color: var(--ink); font: inherit; }
	.panel textarea { min-height: 70px; resize: vertical; }
	.panel details { margin-top: 14px; }
	.panel summary { cursor: pointer; font-weight: 700; }
	.panel-actions { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 14px; }
	.panel-actions .danger { color: #a82a35; }
	.color-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
	.color-grid input { min-height: 36px; padding: 3px; }
	.checks { margin-top: 8px; }
	.import input { padding: 4px; }
	.search-popover { position: absolute; z-index: 125; top: 66px; right: 12px; width: min(380px, calc(100vw - 24px)); display: flex; align-items: center; gap: 5px; padding: 7px; border: 1px solid var(--line); border-radius: 11px; background: var(--panel); }
	.search-popover input { flex: 1; }
	.search-popover span { color: var(--muted); white-space: nowrap; font-size: 12px; }
	.search-popover button { border: 0; border-radius: 6px; background: transparent; color: var(--ink); }
	.context-menu { position: fixed; z-index: 300; display: grid; min-width: 180px; padding: 5px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); box-shadow: 0 12px 35px #122d3333; }
	.context-menu button, .command-palette button { border: 0; border-radius: 7px; padding: 8px 10px; text-align: left; background: transparent; color: var(--ink); cursor: pointer; }
	.context-menu button:hover, .command-palette button:hover { background: color-mix(in srgb, var(--accent) 13%, transparent); }
	.modal-backdrop { position: absolute; inset: 0; z-index: 400; display: grid; place-items: start center; padding-top: min(18vh, 150px); background: #10252b3b; backdrop-filter: blur(3px); }
	.command-palette { width: min(560px, calc(100vw - 30px)); max-height: 55vh; overflow: hidden; padding: 9px; border: 1px solid var(--line); border-radius: 15px; background: var(--panel); box-shadow: 0 24px 70px #0e252b4d; }
	.command-palette > div { display: grid; max-height: 42vh; overflow: auto; margin-top: 6px; }
	.minimap { position: absolute; z-index: 80; right: 12px; bottom: 12px; width: 170px; height: 105px; overflow: hidden; border: 1px solid var(--line); border-radius: 10px; background: color-mix(in srgb, var(--panel) 90%, transparent); box-shadow: 0 5px 20px #173b421c; }
	.minimap span { position: absolute; display: block; min-width: 2px; min-height: 2px; border-radius: 1px; background: var(--muted); opacity: .7; }
	.minimap span.selected { background: var(--accent); opacity: 1; }
	.center-message { position: absolute; z-index: 200; inset: 0; display: grid; place-content: center; gap: 10px; text-align: center; background: var(--surface); color: var(--muted); }
	.center-message.error strong { color: #a82a35; font-size: 18px; }
	.center-message a { color: var(--accent); }
	@media (max-width: 700px) { .toolbar { overflow-x: auto; } .tool.brand span, .separator, .save-status { display: none; } .selection-toolbar { max-width: calc(100vw - 20px); overflow-x: auto; } .minimap { width: 120px; height: 75px; } }
</style>
