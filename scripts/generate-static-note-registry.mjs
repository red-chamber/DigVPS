import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notesRoot = path.join(root, "src", "content", "posts", "notes");
const output = path.join(root, "server", "static-notes.js");
const archivedHistoryPath = path.join(root, "src", "data", "note-history.json");

async function collect(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const target = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await collect(target)));
		else if (entry.isFile() && entry.name.endsWith(".md")) files.push(target);
	}
	return files;
}

const notes = await Promise.all(
	(await collect(notesRoot)).map(async (file) => {
		const slug = path
			.relative(path.join(root, "src", "content", "posts"), file)
			.replaceAll(path.sep, "/")
			.replace(/\.md$/u, "");
		const source = await readFile(file, "utf8");
		const frontmatter = source.match(/^---\s*([\s\S]*?)\s*---/u)?.[1] || "";
		const scalar = (name, fallback = "") => {
			const raw = frontmatter
				.match(new RegExp(`^${name}:\\s*(.+)$`, "mu"))?.[1]
				?.trim();
			return (raw || fallback).replace(/^(?:"(.*)"|'(.*)')$/u, "$1$2");
		};
		const history = [];
		const historyBlock = frontmatter.match(
			/^history:\s*\n((?:[ \t]+.*(?:\n|$))*)/mu,
		)?.[1];
		if (historyBlock) {
			let current = null;
			for (const line of historyBlock.split(/\r?\n/u)) {
				const date = line.match(/^\s*-\s*date:\s*(.+)\s*$/u)?.[1];
				if (date) {
					if (current?.date && current?.action) history.push(current);
					current = { date: date.replace(/["']/gu, ""), action: "updated" };
					continue;
				}
				const action = line.match(/^\s+action:\s*(published|updated)\s*$/u)?.[1];
				if (action && current) current.action = action;
			}
			if (current?.date && current?.action) history.push(current);
		}
		let tags = [];
		try {
			tags = JSON.parse(scalar("tags", "[]"));
		} catch {
			tags = [];
		}
		return [
			slug,
			{
				title: scalar("title", slug),
				description: scalar("description"),
				category: scalar("category"),
				tags: Array.isArray(tags) ? tags.map(String) : [],
				published: scalar("published"),
				updated: scalar("updated"),
				history,
			},
		];
	}),
);
notes.sort(([left], [right]) => left.localeCompare(right, "zh-CN"));
const archivedTimelineEvents = JSON.parse(
	await readFile(archivedHistoryPath, "utf8"),
);

const source = `// Generated from src/content/posts/notes. Keep this list in sync by running
// \`node scripts/generate-static-note-registry.mjs\` (the build command does this).
export const STATIC_NOTES = new Map(${JSON.stringify(notes, null, "\t")});
export const STATIC_NOTE_SLUGS = new Set(STATIC_NOTES.keys());
export const ARCHIVED_TIMELINE_EVENTS = ${JSON.stringify(archivedTimelineEvents, null, "\t")};
`;

await writeFile(output, source, "utf8");
console.log(`Generated static note registry with ${notes.length} entries.`);
