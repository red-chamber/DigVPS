import {
	type CanvasDocument,
	type CanvasEdge,
	type CanvasNode,
	createNode,
	newId,
	type Point,
} from "./model";

export interface Change {
	kind: "node" | "edge";
	id: string;
	before?: CanvasNode | CanvasEdge;
	after?: CanvasNode | CanvasEdge;
}
export interface Patch {
	changes: Change[];
	label: string;
}
type Listener = (patch: Patch) => void;
export class CanvasStore {
	nodes: Map<string, CanvasNode>;
	edges: Map<string, CanvasEdge>;
	private past: Patch[] = [];
	private future: Patch[] = [];
	private listeners = new Set<Listener>();
	constructor(public document: CanvasDocument) {
		this.nodes = new Map(document.nodes.map((n) => [n.id, n]));
		this.edges = new Map(document.edges.map((e) => [e.id, e]));
	}
	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	private apply(patch: Patch, reverse = false): void {
		for (const c of patch.changes) {
			const value = reverse ? c.before : c.after;
			if (c.kind === "node") {
				if (value) this.nodes.set(c.id, value as CanvasNode);
				else this.nodes.delete(c.id);
			} else {
				if (value) this.edges.set(c.id, value as CanvasEdge);
				else this.edges.delete(c.id);
			}
		}
		this.document.updatedAt = Date.now();
		for (const listener of this.listeners) listener(patch);
	}
	commit(changes: Change[], label = "Edit"): void {
		if (!changes.length) return;
		const patch = { changes, label };
		this.past.push(patch);
		if (this.past.length > 100) this.past.shift();
		this.future = [];
		this.apply(patch);
	}
	updateNodes(updates: CanvasNode[], label = "Edit nodes"): void {
		this.commit(
			updates.map((after) => ({
				kind: "node",
				id: after.id,
				before: this.nodes.get(after.id),
				after,
			})),
			label,
		);
	}
	updateEdges(updates: CanvasEdge[], label = "Edit edges"): void {
		this.commit(
			updates.map((after) => ({
				kind: "edge",
				id: after.id,
				before: this.edges.get(after.id),
				after,
			})),
			label,
		);
	}
	undo(): void {
		const p = this.past.pop();
		if (p) {
			this.future.push(p);
			this.apply(p, true);
		}
	}
	redo(): void {
		const p = this.future.pop();
		if (p) {
			this.past.push(p);
			this.apply(p);
		}
	}
	get canUndo(): boolean {
		return this.past.length > 0;
	}
	get canRedo(): boolean {
		return this.future.length > 0;
	}
	snapshot(): CanvasDocument {
		return {
			...this.document,
			nodes: [...this.nodes.values()],
			edges: [...this.edges.values()],
		};
	}
	descendants(ids: Iterable<string>): Set<string> {
		const set = new Set(ids);
		let added = true;
		while (added) {
			added = false;
			for (const n of this.nodes.values())
				if (n.parentId && set.has(n.parentId) && !set.has(n.id)) {
					set.add(n.id);
					added = true;
				}
		}
		return set;
	}
	remove(ids: Iterable<string>): void {
		const selected = this.descendants(ids);
		const changes: Change[] = [];
		for (const n of this.nodes.values())
			if (selected.has(n.id) && !n.locked)
				changes.push({ kind: "node", id: n.id, before: n });
		const removed = new Set(changes.map((c) => c.id));
		for (const e of this.edges.values())
			if (
				selected.has(e.id) ||
				removed.has(e.fromNode) ||
				removed.has(e.toNode)
			)
				changes.push({ kind: "edge", id: e.id, before: e });
		this.commit(changes, "Delete");
	}
	copy(ids: Iterable<string>): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
		const selected = this.descendants(ids);
		return {
			nodes: [...this.nodes.values()].filter((n) => selected.has(n.id)),
			edges: [...this.edges.values()].filter(
				(e) => selected.has(e.fromNode) && selected.has(e.toNode),
			),
		};
	}
	paste(
		data: { nodes: CanvasNode[]; edges: CanvasEdge[] },
		offset: Point = { x: 40, y: 40 },
	): string[] {
		const map = new Map(data.nodes.map((n) => [n.id, newId()]));
		const changes: Change[] = data.nodes.map((n) => {
			const id = map.get(n.id) as string;
			return {
				kind: "node",
				id,
				after: {
					...n,
					id,
					x: n.x + offset.x,
					y: n.y + offset.y,
					parentId: n.parentId ? map.get(n.parentId) : undefined,
				},
			};
		});
		for (const e of data.edges) {
			const fromNode = map.get(e.fromNode);
			const toNode = map.get(e.toNode);
			if (fromNode && toNode) {
				const id = newId();
				changes.push({
					kind: "edge",
					id,
					after: { ...e, id, fromNode, toNode },
				});
			}
		}
		this.commit(changes, "Paste");
		return [...map.values()];
	}
	group(ids: Iterable<string>): string | undefined {
		const selected = [...ids]
			.map((id) => this.nodes.get(id))
			.filter((n): n is CanvasNode => Boolean(n) && !n?.locked);
		if (!selected.length) return;
		const x = Math.min(...selected.map((n) => n.x)) - 30;
		const y = Math.min(...selected.map((n) => n.y)) - 50;
		const group = createNode("group", x, y, this.document.settings);
		group.width = Math.max(...selected.map((n) => n.x + n.width)) - x + 30;
		group.height = Math.max(...selected.map((n) => n.y + n.height)) - y + 30;
		const selectedIds = new Set(selected.map((n) => n.id));
		this.updateNodes(
			[
				group,
				...selected
					.filter((n) => !n.parentId || !selectedIds.has(n.parentId))
					.map((n) => ({ ...n, parentId: group.id })),
			],
			"Group",
		);
		return group.id;
	}
	displayNode(id: string): CanvasNode | undefined {
		let n = this.nodes.get(id);
		let display = n;
		const seen = new Set<string>();
		while (n?.parentId && !seen.has(n.id)) {
			seen.add(n.id);
			n = this.nodes.get(n.parentId);
			if (n?.data.collapsed) display = n;
		}
		return display;
	}
}
