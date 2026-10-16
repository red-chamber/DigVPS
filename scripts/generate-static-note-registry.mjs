import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notesRoot = path.join(root, "src", "content", "posts", "notes");
const output = path.join(root, "server", "static-notes.js");

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
		const scalar = (name, fallback = "") => {
			const raw = source
				.match(new RegExp(`^${name}:\\s*(.+)$`, "mu"))?.[1]
				?.trim();
			return (raw || fallback).replace(/^(?:"(.*)"|'(.*)')$/u, "$1$2");
		};
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
			},
		];
	}),
);
notes.sort(([left], [right]) => left.localeCompare(right, "zh-CN"));

const source = `// Generated from src/content/posts/notes. Keep this list in sync by running
// \`node scripts/generate-static-note-registry.mjs\` (the build command does this).
export const STATIC_NOTES = new Map(${JSON.stringify(notes, null, "\t")});
export const STATIC_NOTE_SLUGS = new Set(STATIC_NOTES.keys());
`;

await writeFile(output, source, "utf8");
console.log(`Generated static note registry with ${notes.length} entries.`);
