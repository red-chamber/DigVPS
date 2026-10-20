import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import python from "highlight.js/lib/languages/python";
import katex from "katex";
import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import "katex/dist/katex.css";

hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c++", cpp);

const parser = new MarkdownIt({
	html: false,
	linkify: true,
	highlight(source, language) {
		if (!language || !hljs.getLanguage(language)) return "";
		return `<pre><code class="hljs language-${language}">${hljs.highlight(source, { language }).value}</code></pre>`;
	},
}).use(texmath, {
	engine: katex,
	delimiters: "dollars",
	katexOptions: {
		trust: false,
		throwOnError: false,
		maxExpand: 1000,
		maxSize: 20,
	},
});
const cache = new Map<string, string>();
export function renderCanvasMarkdown(source: string): string {
	const existing = cache.get(source);
	if (existing !== undefined) return existing;
	const rendered = parser
		.render(source)
		.replace(
			/<li>\[([ xX])\] /gu,
			(_, checked: string) =>
				`<li><input type="checkbox" disabled ${checked.toLowerCase() === "x" ? "checked" : ""}> `,
		);
	const html = DOMPurify.sanitize(rendered, {
		ADD_ATTR: ["target"],
		FORBID_TAGS: ["style", "iframe", "object", "embed"],
		FORBID_ATTR: ["srcdoc"],
	});
	cache.set(source, html);
	if (cache.size > 256) cache.delete(cache.keys().next().value as string);
	return html;
}
