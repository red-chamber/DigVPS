export function element<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className = "",
	text = "",
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	el.className = className;
	if (text) el.textContent = text;
	return el;
}
export function button(
	label: string,
	action: () => void,
	className = "",
): HTMLButtonElement {
	const el = element("button", className, label);
	el.type = "button";
	el.title = label;
	el.setAttribute("aria-label", label);
	el.addEventListener("click", action);
	return el;
}
export function svg<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
	const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
	for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
	return el;
}
export function download(name: string, blob: Blob): void {
	const url = URL.createObjectURL(blob);
	const link = element("a");
	link.href = url;
	link.download = name;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
