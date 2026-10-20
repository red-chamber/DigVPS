import { edgePath, visualBox } from "./geometry";
import type { CanvasEdge, CanvasNode } from "./model";

self.onmessage = (
	event: MessageEvent<{
		revision: number;
		nodes: CanvasNode[];
		edges: CanvasEdge[];
	}>,
) => {
	const { revision, nodes, edges } = event.data;
	const map = new Map(nodes.map((n) => [n.id, n]));
	const routes = edges.flatMap((e) => {
		const from = map.get(e.fromNode);
		const to = map.get(e.toNode);
		if (!from || !to) return [];
		return [
			{
				id: e.id,
				...edgePath(
					e,
					visualBox(from),
					visualBox(to),
					nodes
						.filter(
							(n) => n.id !== from.id && n.id !== to.id && n.type !== "group",
						)
						.map(visualBox),
				),
			},
		];
	});
	self.postMessage({ revision, routes });
};
