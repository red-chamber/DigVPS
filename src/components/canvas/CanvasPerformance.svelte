<script lang="ts">
import { onMount } from "svelte";
import { createEdge, createNode, emptyDocument } from "../../canvas/model";
import AdvancedCanvasEditor from "./AdvancedCanvasEditor.svelte";

const params =
	typeof location === "undefined"
		? new URLSearchParams()
		: new URLSearchParams(location.search);
const count = params.get("nodes") === "500" ? 500 : 1000;
const document = emptyDocument(
	`performance-${count}`,
	`${count}-node performance canvas`,
);
for (let index = 0; index < count; index++) {
	const column = index % 40;
	const row = Math.floor(index / 40);
	const node = createNode(
		index % 7 === 0 ? "markdown" : "text",
		column * 330,
		row * 220,
		document.settings,
	);
	node.id = `perf-node-${index}`;
	node.width = 250;
	node.height = 145;
	node.data = {
		title: `Node ${index + 1}`,
		text:
			index % 7 === 0
				? `## Cached Markdown ${index + 1}\n\nA small formula $x_${index}^2$.`
				: `Performance sample ${index + 1}`,
	};
	document.nodes.push(node);
}
const edgeCount = count === 1000 ? 1500 : 700;
for (let index = 0; index < edgeCount; index++) {
	const edge = createEdge(
		`perf-node-${index % count}`,
		`perf-node-${(index * 17 + 41) % count}`,
	);
	edge.id = `perf-edge-${index}`;
	edge.routing = index % 5 === 0 ? "orthogonal" : "bezier";
	document.edges.push(edge);
}
document.viewport = { x: 80, y: 90, zoom: 0.42 };

let fps = 0;
onMount(() => {
	let frames = 0;
	let last = performance.now();
	let frame = 0;
	const tick = (now: number) => {
		frames++;
		if (now - last >= 1000) {
			fps = Math.round((frames * 1000) / (now - last));
			frames = 0;
			last = now;
		}
		frame = requestAnimationFrame(tick);
	};
	frame = requestAnimationFrame(tick);
	return () => cancelAnimationFrame(frame);
});
</script>

<div class="performance-badge" aria-live="polite">{count} nodes · {edgeCount} edges · {fps || "…"} FPS</div>
<AdvancedCanvasEditor documentId={document.id} initialDocument={document} readOnly />

<style>
	.performance-badge { position: absolute; z-index: 500; left: 50%; bottom: 14px; transform: translateX(-50%); padding: 7px 11px; border: 1px solid #b9ced3; border-radius: 999px; background: rgba(255,255,255,.9); color: #264b53; box-shadow: 0 5px 20px #173b421c; font: 600 12px/1 Roboto, sans-serif; backdrop-filter: blur(12px); }
</style>
