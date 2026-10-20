export type NodeType =
	| "text"
	| "markdown"
	| "image"
	| "file"
	| "link"
	| "group"
	| "portal";
export type Side = "top" | "right" | "bottom" | "left" | "auto";
export interface Point {
	x: number;
	y: number;
}
export interface Viewport extends Point {
	zoom: number;
}
export interface NodeStyle {
	background: string;
	border: string;
	color: string;
	opacity: number;
	shape:
		| "rounded"
		| "rectangle"
		| "pill"
		| "diamond"
		| "process"
		| "document"
		| "database";
	line: "solid" | "dashed" | "dotted" | "hidden";
	align: "left" | "center" | "right";
}
export interface CanvasNode extends Point {
	id: string;
	type: NodeType;
	width: number;
	height: number;
	data: {
		title: string;
		text: string;
		url?: string;
		documentId?: string;
		collapsed?: boolean;
		[key: string]: unknown;
	};
	style: NodeStyle;
	parentId?: string;
	zIndex: number;
	dynamicHeight: boolean;
	locked: boolean;
	aspectRatio: boolean;
	[key: string]: unknown;
}
export interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	fromSide: Side;
	toSide: Side;
	label: string;
	routing: "straight" | "bezier" | "elbow" | "orthogonal";
	fromEnd: "none" | "arrow" | "circle" | "diamond";
	toEnd: "none" | "arrow" | "circle" | "diamond";
	style: { color: string; width: number; line: "solid" | "dashed" | "dotted" };
	[key: string]: unknown;
}
export interface CanvasSettings {
	grid: boolean;
	snap: boolean;
	gridSize: number;
	theme: "light" | "dark";
	accent: string;
	detailThreshold: number;
	minimap: boolean;
	defaultWidth: number;
	defaultHeight: number;
	defaultStyle: NodeStyle;
	templates: Record<string, NodeStyle>;
	[key: string]: unknown;
}
export interface CanvasDocument {
	version: number;
	id: string;
	title: string;
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	viewport: Viewport;
	settings: CanvasSettings;
	createdAt: number;
	updatedAt: number;
	[key: string]: unknown;
}
export const defaultStyle: NodeStyle = {
	background: "#f7fbfc",
	border: "#7aabb4",
	color: "#183940",
	opacity: 1,
	shape: "rounded",
	line: "solid",
	align: "left",
};
export const limits = {
	minWidth: 100,
	minHeight: 70,
	maxWidth: 3000,
	maxHeight: 5000,
	maxNodes: 5000,
	maxEdges: 10000,
};
export const newId = (): string => crypto.randomUUID();
export const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));
export function safeUrl(value: string): string {
	if (/^\/(?!\/)/u.test(value) && !value.includes("\\")) return value;
	try {
		const url = new URL(value);
		return ["https:", "http:"].includes(url.protocol) ? url.href : "";
	} catch {
		return "";
	}
}
export function emptyDocument(
	id = newId(),
	title = "Untitled whiteboard",
): CanvasDocument {
	return {
		version: 1,
		id,
		title,
		nodes: [],
		edges: [],
		viewport: { x: 0, y: 0, zoom: 1 },
		settings: {
			grid: true,
			snap: true,
			gridSize: 20,
			theme: "light",
			accent: "#168898",
			detailThreshold: 0.35,
			minimap: true,
			defaultWidth: 280,
			defaultHeight: 180,
			defaultStyle: { ...defaultStyle },
			templates: {},
		},
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
}
export function createNode(
	type: NodeType,
	x: number,
	y: number,
	settings = emptyDocument().settings,
): CanvasNode {
	return {
		id: newId(),
		type,
		x,
		y,
		width: settings.defaultWidth,
		height: settings.defaultHeight,
		data: { title: type === "group" ? "Group" : "", text: "" },
		style: { ...settings.defaultStyle },
		zIndex: type === "group" ? -1 : 0,
		dynamicHeight: type === "markdown" || type === "text",
		locked: false,
		aspectRatio: false,
	};
}
export function createEdge(fromNode: string, toNode: string): CanvasEdge {
	return {
		id: newId(),
		fromNode,
		toNode,
		fromSide: "auto",
		toSide: "auto",
		label: "",
		routing: "bezier",
		fromEnd: "none",
		toEnd: "arrow",
		style: { color: "#568992", width: 2, line: "solid" },
	};
}
function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Invalid canvas object.");
	return value as Record<string, unknown>;
}
function number(
	value: unknown,
	fallback: number,
	min: number,
	max: number,
): number {
	return typeof value === "number" && Number.isFinite(value)
		? clamp(value, min, max)
		: fallback;
}
const types = new Set<NodeType>([
	"text",
	"markdown",
	"image",
	"file",
	"link",
	"group",
	"portal",
]);
const sides = new Set(["top", "right", "bottom", "left", "auto"]);
const palette: Record<string, string> = {
	"1": "#f9c3c0",
	"2": "#f4d1ad",
	"3": "#f6e5a1",
	"4": "#c0e5c5",
	"5": "#c0e0f3",
	"6": "#dacaf1",
};

/** v0 is standard JSON Canvas. Extensions are kept inside x-cedrian on export. */
export function migrateDocument(value: unknown): CanvasDocument {
	const raw = record(value);
	if (typeof raw.version === "number" && raw.version > 1)
		throw new Error("This canvas version is newer than this editor.");
	const standard = raw.version !== 1;
	const extension =
		standard && raw["x-cedrian"] ? record(raw["x-cedrian"]) : {};
	const base = emptyDocument();
	const source = { ...raw, ...extension };
	const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
	const edges = Array.isArray(raw.edges) ? raw.edges : [];
	if (nodes.length > limits.maxNodes || edges.length > limits.maxEdges)
		throw new Error("Canvas exceeds the supported document size.");
	const ids = new Set<string>();
	const result: CanvasDocument = {
		...base,
		...source,
		version: 1,
		id: typeof source.id === "string" ? source.id : base.id,
		title: String(source.title || base.title),
		settings: {
			...base.settings,
			...(source.settings ? record(source.settings) : {}),
		},
		viewport: {
			...base.viewport,
			...(source.viewport ? record(source.viewport) : {}),
		},
		nodes: nodes.map((value) => {
			const n = record(value);
			const ext = standard && n["x-cedrian"] ? record(n["x-cedrian"]) : {};
			const merged = { ...n, ...ext };
			const type = types.has(merged.type as NodeType)
				? (merged.type as NodeType)
				: "text";
			const node = createNode(type, 0, 0);
			const id = typeof n.id === "string" ? n.id : newId();
			if (ids.has(id)) throw new Error("Duplicate node ID.");
			ids.add(id);
			const data = merged.data ? record(merged.data) : {};
			return {
				...n,
				...ext,
				...node,
				...merged,
				id,
				type,
				x: number(n.x, 0, -1e7, 1e7),
				y: number(n.y, 0, -1e7, 1e7),
				width: number(n.width, 280, limits.minWidth, limits.maxWidth),
				height: number(n.height, 180, limits.minHeight, limits.maxHeight),
				data: {
					...data,
					title: String(data.title ?? n.label ?? ""),
					text: String(data.text ?? n.text ?? ""),
					url: String(data.url ?? n.url ?? n.file ?? ""),
				},
				style: {
					...defaultStyle,
					...(n.color
						? { background: palette[String(n.color)] || String(n.color) }
						: {}),
					...(merged.style ? record(merged.style) : {}),
				},
				parentId:
					typeof merged.parentId === "string" ? merged.parentId : undefined,
				zIndex: number(merged.zIndex, type === "group" ? -1 : 0, -1e6, 1e6),
				dynamicHeight: Boolean(merged.dynamicHeight ?? node.dynamicHeight),
				locked: Boolean(merged.locked),
				aspectRatio: Boolean(merged.aspectRatio),
			} as CanvasNode;
		}),
		edges: edges
			.map((value) => {
				const e = record(value);
				const ext = standard && e["x-cedrian"] ? record(e["x-cedrian"]) : {};
				const merged = { ...e, ...ext };
				const edge = createEdge(String(e.fromNode), String(e.toNode));
				return {
					...e,
					...edge,
					...merged,
					id: String(e.id || edge.id),
					fromNode: String(e.fromNode),
					toNode: String(e.toNode),
					label: String(e.label || ""),
					fromSide: sides.has(String(merged.fromSide))
						? merged.fromSide
						: "auto",
					toSide: sides.has(String(merged.toSide)) ? merged.toSide : "auto",
					style: {
						...edge.style,
						...(e.color
							? { color: palette[String(e.color)] || String(e.color) }
							: {}),
						...(merged.style ? record(merged.style) : {}),
					},
				} as CanvasEdge;
			})
			.filter((e) => ids.has(e.fromNode) && ids.has(e.toNode)),
	};
	const edgeIds = new Set(result.edges.map((e) => e.id));
	if (edgeIds.size !== result.edges.length)
		throw new Error("Duplicate edge ID.");
	const byId = new Map(result.nodes.map((n) => [n.id, n]));
	for (const n of result.nodes) {
		if (!n.parentId) continue;
		const seen = new Set([n.id]);
		let parent = byId.get(n.parentId);
		if (!parent || parent.type !== "group") {
			n.parentId = undefined;
			continue;
		}
		while (parent) {
			if (seen.has(parent.id))
				throw new Error("Circular groups are not supported.");
			seen.add(parent.id);
			parent = parent.parentId ? byId.get(parent.parentId) : undefined;
		}
	}
	result.settings.defaultStyle = {
		...defaultStyle,
		...result.settings.defaultStyle,
	};
	result.settings.gridSize = number(result.settings.gridSize, 20, 5, 200);
	result.viewport.zoom = number(result.viewport.zoom, 1, 0.08, 4);
	result.viewport.x = number(result.viewport.x, 0, -1e7, 1e7);
	result.viewport.y = number(result.viewport.y, 0, -1e7, 1e7);
	return result;
}
export function exportCanvas(doc: CanvasDocument): Record<string, unknown> {
	const { nodes, edges, ...meta } = doc;
	return {
		...doc,
		version: undefined,
		nodes: nodes.map((n) => ({
			...n,
			type: ["image", "file"].includes(n.type)
				? "file"
				: n.type === "portal"
					? "link"
					: n.type === "markdown"
						? "text"
						: n.type,
			text: n.data.text,
			label: n.data.title,
			color: n.style.background,
			file: ["image", "file"].includes(n.type) ? n.data.url : undefined,
			url:
				n.type === "portal"
					? `/whiteboards/edit/?id=${encodeURIComponent(n.data.documentId || "")}`
					: n.data.url,
			data: undefined,
			style: undefined,
			parentId: undefined,
			zIndex: undefined,
			dynamicHeight: undefined,
			locked: undefined,
			aspectRatio: undefined,
			"x-cedrian": {
				type: n.type,
				data: n.data,
				style: n.style,
				parentId: n.parentId,
				zIndex: n.zIndex,
				dynamicHeight: n.dynamicHeight,
				locked: n.locked,
				aspectRatio: n.aspectRatio,
			},
		})),
		edges: edges.map((e) => ({
			...e,
			fromSide: e.fromSide === "auto" ? undefined : e.fromSide,
			toSide: e.toSide === "auto" ? undefined : e.toSide,
			fromEnd: e.fromEnd === "none" ? "none" : "arrow",
			toEnd: e.toEnd === "none" ? "none" : "arrow",
			style: undefined,
			routing: undefined,
			"x-cedrian": {
				style: e.style,
				routing: e.routing,
				fromEnd: e.fromEnd,
				toEnd: e.toEnd,
				fromSide: e.fromSide,
				toSide: e.toSide,
			},
		})),
		"x-cedrian": meta,
	};
}
