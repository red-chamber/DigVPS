import { download, svg } from "./dom";
import { bounds, edgePath, visualBox } from "./geometry";
import { type CanvasDocument, type CanvasNode, safeUrl } from "./model";

function lines(text: string, width: number): string[] {
	const max = Math.max(10, Math.floor(width / 8));
	return text
		.split("\n")
		.flatMap((line) => line.match(new RegExp(`.{1,${max}}`, "gu")) || [""]);
}
async function inlineImage(url: string): Promise<string> {
	const safe = safeUrl(url);
	if (!safe) return "";
	try {
		const response = await fetch(safe, {
			credentials: safe.startsWith("/") ? "same-origin" : "omit",
		});
		if (!response.ok) return "";
		const blob = await response.blob();
		if (!/^image\/(png|jpeg|webp|gif)$/u.test(blob.type)) return "";
		return await new Promise<string>((resolve) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => resolve("");
			reader.readAsDataURL(blob);
		});
	} catch {
		return "";
	}
}
/** Self-contained SVG, without foreignObject or remote image dependencies. */
export async function exportVisual(
	doc: CanvasDocument,
	selected: Set<string>,
	format: "svg" | "png",
	transparent: boolean,
): Promise<void> {
	const nodes = doc.nodes.filter((n) => !selected.size || selected.has(n.id));
	const box = bounds(nodes.map(visualBox));
	const pad = 40;
	const width = box.width + pad * 2;
	const height = box.height + pad * 2;
	const root = svg("svg", {
		xmlns: "http://www.w3.org/2000/svg",
		width: String(width),
		height: String(height),
		viewBox: `${box.x - pad} ${box.y - pad} ${width} ${height}`,
	});
	if (!transparent)
		root.append(
			svg("rect", {
				x: String(box.x - pad),
				y: String(box.y - pad),
				width: String(width),
				height: String(height),
				fill: doc.settings.theme === "dark" ? "#142329" : "#eef5f7",
			}),
		);
	const map = new Map(nodes.map((n) => [n.id, n]));
	for (const edge of doc.edges) {
		const a = map.get(edge.fromNode);
		const b = map.get(edge.toNode);
		if (!a || !b) continue;
		const path = edgePath(edge, visualBox(a), visualBox(b));
		root.append(
			svg("path", {
				d: path.path,
				fill: "none",
				stroke: edge.style.color,
				"stroke-width": String(edge.style.width),
				"stroke-dasharray":
					edge.style.line === "dashed"
						? "8 5"
						: edge.style.line === "dotted"
							? "2 4"
							: "",
			}),
		);
		const label = svg("text", {
			x: String(path.label.x),
			y: String(path.label.y - 5),
			fill: edge.style.color,
			"font-size": "14",
		});
		label.textContent = edge.label;
		root.append(label);
	}
	const images = await Promise.all(
		nodes.map(async (n) =>
			n.type === "image" && n.data.url ? inlineImage(n.data.url) : "",
		),
	);
	for (const [index, n] of [...nodes]
		.sort((a, b) => a.zIndex - b.zIndex)
		.map((n) => [nodes.indexOf(n), n] as [number, CanvasNode])) {
		const group = svg("g", { opacity: String(n.style.opacity) });
		const shape = visualBox(n);
		group.append(
			svg("rect", {
				x: String(n.x),
				y: String(n.y),
				width: String(shape.width),
				height: String(shape.height),
				rx:
					n.style.shape === "pill"
						? "60"
						: n.style.shape === "rectangle"
							? "0"
							: "12",
				fill: n.style.background,
				stroke: n.style.line === "hidden" ? "none" : n.style.border,
				"stroke-dasharray":
					n.style.line === "dashed"
						? "8 5"
						: n.style.line === "dotted"
							? "2 4"
							: "",
			}),
		);
		if (images[index])
			group.append(
				svg("image", {
					href: images[index],
					x: String(n.x + 10),
					y: String(n.y + 32),
					width: String(n.width - 20),
					height: String(n.height - 42),
					preserveAspectRatio: "xMidYMid meet",
				}),
			);
		const text =
			n.data.title +
			(n.data.collapsed ? "" : `\n${n.data.text || n.data.url || ""}`);
		for (const [i, line] of lines(text, n.width - 28)
			.slice(0, Math.floor((shape.height - 16) / 20))
			.entries()) {
			const t = svg("text", {
				x: String(n.x + 14),
				y: String(n.y + 24 + i * 20),
				fill: n.style.color,
				"font-family": "sans-serif",
				"font-size": "14",
			});
			t.textContent = line;
			group.append(t);
		}
		root.append(group);
	}
	const blob = new Blob([new XMLSerializer().serializeToString(root)], {
		type: "image/svg+xml",
	});
	if (format === "svg") {
		download(`${doc.title}.svg`, blob);
		return;
	}
	const scale = Math.min(
		2,
		8192 / Math.max(width, height),
		Math.sqrt(32_000_000 / (width * height)),
	);
	const canvas = document.createElement("canvas");
	canvas.width = Math.ceil(width * scale);
	canvas.height = Math.ceil(height * scale);
	const image = new Image();
	const url = URL.createObjectURL(blob);
	try {
		image.src = url;
		await image.decode();
		canvas
			.getContext("2d")
			?.drawImage(image, 0, 0, canvas.width, canvas.height);
		const png = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/png"),
		);
		if (png) download(`${doc.title}.png`, png);
	} finally {
		URL.revokeObjectURL(url);
	}
}
