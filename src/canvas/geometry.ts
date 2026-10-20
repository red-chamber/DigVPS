import type { CanvasEdge, CanvasNode, Point, Side } from "./model";
export interface Box extends Point {
	width: number;
	height: number;
}
export function bounds(nodes: Box[]): Box {
	if (!nodes.length) return { x: 0, y: 0, width: 500, height: 400 };
	const x = Math.min(...nodes.map((n) => n.x));
	const y = Math.min(...nodes.map((n) => n.y));
	return {
		x,
		y,
		width: Math.max(...nodes.map((n) => n.x + n.width)) - x,
		height: Math.max(...nodes.map((n) => n.y + n.height)) - y,
	};
}
export function intersects(a: Box, b: Box): boolean {
	return (
		a.x < b.x + b.width &&
		a.x + a.width > b.x &&
		a.y < b.y + b.height &&
		a.y + a.height > b.y
	);
}
export function anchor(node: Box, toward: Box, side: Side): Point {
	const cx = node.x + node.width / 2;
	const cy = node.y + node.height / 2;
	const dx = toward.x + toward.width / 2 - cx;
	const dy = toward.y + toward.height / 2 - cy;
	const s =
		side !== "auto"
			? side
			: Math.abs(dx / node.width) > Math.abs(dy / node.height)
				? dx > 0
					? "right"
					: "left"
				: dy > 0
					? "bottom"
					: "top";
	return s === "left"
		? { x: node.x, y: cy }
		: s === "right"
			? { x: node.x + node.width, y: cy }
			: s === "top"
				? { x: cx, y: node.y }
				: { x: cx, y: node.y + node.height };
}
function segmentsHit(points: Point[], obstacle: Box): boolean {
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		if (
			a.x === b.x &&
			a.x > obstacle.x - 10 &&
			a.x < obstacle.x + obstacle.width + 10 &&
			Math.max(a.y, b.y) > obstacle.y - 10 &&
			Math.min(a.y, b.y) < obstacle.y + obstacle.height + 10
		)
			return true;
		if (
			a.y === b.y &&
			a.y > obstacle.y - 10 &&
			a.y < obstacle.y + obstacle.height + 10 &&
			Math.max(a.x, b.x) > obstacle.x - 10 &&
			Math.min(a.x, b.x) < obstacle.x + obstacle.width + 10
		)
			return true;
	}
	return false;
}
export function edgePath(
	edge: CanvasEdge,
	from: Box,
	to: Box,
	obstacles: Box[] = [],
): { path: string; label: Point } {
	const a = anchor(from, to, edge.fromSide);
	const b = anchor(to, from, edge.toSide);
	const label = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	if (edge.routing === "straight")
		return { path: `M${a.x},${a.y} L${b.x},${b.y}`, label };
	if (edge.routing === "bezier") {
		const dx = Math.max(60, Math.abs(b.x - a.x) / 2);
		return {
			path: `M${a.x},${a.y} C${a.x + (b.x >= a.x ? dx : -dx)},${a.y} ${b.x - (b.x >= a.x ? dx : -dx)},${b.y} ${b.x},${b.y}`,
			label,
		};
	}
	const candidates: Point[][] = [
		[a, { x: label.x, y: a.y }, { x: label.x, y: b.y }, b],
		[a, { x: a.x, y: label.y }, { x: b.x, y: label.y }, b],
	];
	if (edge.routing === "orthogonal") {
		const nearby = obstacles.filter((o) =>
			intersects(o, {
				x: Math.min(a.x, b.x) - 80,
				y: Math.min(a.y, b.y) - 80,
				width: Math.abs(b.x - a.x) + 160,
				height: Math.abs(b.y - a.y) + 160,
			}),
		);
		for (const o of nearby.slice(0, 30)) {
			for (const y of [o.y - 30, o.y + o.height + 30])
				candidates.push([a, { x: a.x, y }, { x: b.x, y }, b]);
			for (const x of [o.x - 30, o.x + o.width + 30])
				candidates.push([a, { x, y: a.y }, { x, y: b.y }, b]);
		}
	}
	const score = (points: Point[]) =>
		points.reduce(
			(sum, p, i) =>
				i
					? sum +
						Math.abs(p.x - points[i - 1].x) +
						Math.abs(p.y - points[i - 1].y)
					: 0,
			0,
		) +
		obstacles.filter((o) => segmentsHit(points, o)).length * 100000;
	const points = candidates.reduce((best, next) =>
		score(next) < score(best) ? next : best,
	);
	return {
		path: points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "),
		label,
	};
}
export function visualBox(node: CanvasNode): Box {
	return {
		x: node.x,
		y: node.y,
		width: node.width,
		height: node.type === "group" && node.data.collapsed ? 70 : node.height,
	};
}
