import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourceRoot = path.resolve(
	process.env.LEARNING_NOTES_DIR || "D:\\LearningNotes",
);
const contentRoot = path.resolve(projectRoot, "src", "content");
const postsRoot = path.resolve(contentRoot, "posts");
const destinationRoot = path.resolve(postsRoot, "notes");
const legacyDestinationRoot = path.resolve(contentRoot, "notes");
const templateGuideRoot = path.resolve(postsRoot, "guide");

const sections = [
	{
		source: "爬虫学习",
		slug: "web-scraping",
		label: "爬虫笔记",
		order: 1,
		tags: ["学习笔记", "爬虫"],
	},
	{
		source: "自然语言处理学习（已定）",
		slug: "natural-language-processing",
		label: "自然语言处理学习",
		order: 2,
		tags: ["学习笔记", "自然语言处理"],
	},
	{
		source: "C++ Contest",
		slug: "cpp-contest",
		label: "C++ Contest",
		order: 3,
		tags: ["学习笔记", "C++", "算法竞赛"],
	},
	{
		source: "HPC",
		slug: "hpc",
		label: "HPC",
		order: 4,
		tags: ["学习笔记", "HPC"],
	},
	{
		source: "Linux",
		slug: "linux",
		label: "Linux",
		order: 5,
		tags: ["学习笔记", "Linux"],
	},
	{
		source: "Python Contest",
		slug: "python-contest",
		label: "Python Contest",
		order: 6,
		tags: ["学习笔记", "Python", "算法竞赛"],
	},
];

const mediaExtensions = new Set([
	".gif",
	".jpeg",
	".jpg",
	".png",
	".svg",
	".webp",
]);

function pathKey(value) {
	return path.resolve(value).toLocaleLowerCase("en-US");
}

function toPosix(value) {
	return value.split(path.sep).join("/");
}

function slugifySegment(value) {
	const normalized = value
		.normalize("NFKC")
		.replace(/\+\+/g, "pp")
		.replace(/\+/g, "plus")
		.toLocaleLowerCase("en-US")
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || "note";
}

function lookupName(value) {
	return value
		.normalize("NFKC")
		.toLocaleLowerCase("en-US")
		.replace(/与/g, "和")
		.replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function tagsFor(section, sourcePath, title) {
	const tags = new Set(section.tags);
	const text = `${sourcePath} ${title}`;
	const keywordTags = [
		[/playwright/i, "Playwright"],
		[/openmp/i, "OpenMP"],
		[/vtune/i, "VTune"],
		[/simd/i, "SIMD"],
		[/gensim/i, "Gensim"],
		[/word2vec/i, "Word2Vec"],
		[/rnn/i, "RNN"],
		[/lstm/i, "LSTM"],
		[/gru/i, "GRU"],
	];
	for (const [pattern, tag] of keywordTags) {
		if (pattern.test(text)) tags.add(tag);
	}
	return [...tags];
}

async function gitDatesFor(sourceFile) {
	const sourcePath = path.relative(sourceRoot, sourceFile);
	let dates = [];
	try {
		dates = execFileSync(
			"git",
			["log", "--follow", "--format=%aI", "--", sourcePath],
			{
				cwd: sourceRoot,
				encoding: "utf8",
				windowsHide: true,
			},
		)
			.trim()
			.split(/\r?\n/)
			.filter(Boolean)
			.map((date) => date.slice(0, 10));
	} catch {
		// Fall back to file timestamps when the source is not tracked yet.
	}
	if (dates.length > 0) {
		return { published: dates.at(-1), updated: dates[0] };
	}
	const stats = await fs.stat(sourceFile);
	return {
		published: stats.birthtime.toISOString().slice(0, 10),
		updated: stats.mtime.toISOString().slice(0, 10),
	};
}

function destinationRelativePath(section, sourceFile, extension) {
	const sourceSection = path.join(sourceRoot, section.source);
	const relative = path.relative(sourceSection, sourceFile);
	const parsed = path.parse(relative);
	const directorySegments = parsed.dir
		.split(path.sep)
		.filter(Boolean)
		.map(slugifySegment);
	const filename = `${slugifySegment(parsed.name)}${extension}`;
	return path.join(section.slug, ...directorySegments, filename);
}

async function walk(directory) {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(fullPath)));
		} else if (entry.isFile()) {
			files.push(fullPath);
		}
	}
	return files;
}

async function exists(filePath) {
	try {
		await fs.access(filePath, fsConstants.F_OK);
		return true;
	} catch {
		return false;
	}
}

function splitTarget(rawTarget) {
	const unwrapped = rawTarget.startsWith("<") && rawTarget.endsWith(">")
		? rawTarget.slice(1, -1)
		: rawTarget;
	const hashIndex = unwrapped.indexOf("#");
	return hashIndex === -1
		? { pathname: unwrapped, hash: "" }
		: {
				pathname: unwrapped.slice(0, hashIndex),
				hash: unwrapped.slice(hashIndex),
			};
}

function decodePathname(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function isExternalTarget(value) {
	return (
		value === "" ||
		value.startsWith("#") ||
		value.startsWith("/") ||
		/^[a-z][a-z\d+.-]*:/i.test(value)
	);
}

function findLocalTarget({ sourceFile, rawTarget, isImage, maps }) {
	const { pathname } = splitTarget(rawTarget);
	if (isExternalTarget(pathname)) return undefined;

	const decoded = decodePathname(pathname);
	const exact = path.resolve(path.dirname(sourceFile), decoded);
	const candidates = [exact];
	if (!path.extname(exact) && !isImage) candidates.push(`${exact}.md`);

	for (const candidate of candidates) {
		const match = isImage
			? maps.assetBySource.get(pathKey(candidate))
			: maps.noteBySource.get(pathKey(candidate));
		if (match) return match;
	}

	const basename = path.basename(decoded, path.extname(decoded));
	const lookup = isImage ? maps.assetsByName : maps.notesByName;
	const matches = lookup.get(lookupName(basename)) || [];
	return matches.length === 1 ? matches[0] : undefined;
}

function rewriteLinks(markdown, sourceFile, destinationFile, maps) {
	return markdown.replace(
		/(!?)\[([^\]]*)\]\((<[^>]+>|[^)\n]+)\)/g,
		(original, imageMarker, label, rawTarget) => {
			const isImage = imageMarker === "!";
			const target = findLocalTarget({
				sourceFile,
				rawTarget,
				isImage,
				maps,
			});
			if (!target) return original;

			const { hash } = splitTarget(rawTarget);
			if (!isImage) {
				return `[${label}](/posts/${target.slug}/${hash})`;
			}

			let relative = path.relative(
				path.dirname(destinationFile),
				target.destination,
			);
			relative = toPosix(relative);
			if (!relative.startsWith(".")) relative = `./${relative}`;
			return `![${label}](${relative}${hash})`;
		},
	);
}

async function main() {
	if (!destinationRoot.startsWith(`${postsRoot}${path.sep}`)) {
		throw new Error("Refusing to replace notes outside src/content/posts.");
	}
	if (!legacyDestinationRoot.startsWith(`${contentRoot}${path.sep}`)) {
		throw new Error("Refusing to remove legacy notes outside src/content.");
	}
	if (!templateGuideRoot.startsWith(`${postsRoot}${path.sep}`)) {
		throw new Error("Refusing to remove template content outside src/content/posts.");
	}
	if (!(await exists(sourceRoot))) {
		throw new Error(`LearningNotes repository not found: ${sourceRoot}`);
	}

	const noteRecords = [];
	const assetRecords = [];
	for (const section of sections) {
		const sectionRoot = path.join(sourceRoot, section.source);
		if (!(await exists(sectionRoot))) {
			throw new Error(`Missing notes directory: ${sectionRoot}`);
		}
		for (const sourceFile of await walk(sectionRoot)) {
			const extension = path.extname(sourceFile).toLocaleLowerCase("en-US");
			if (extension === ".md") {
				const relativeDestination = destinationRelativePath(
					section,
					sourceFile,
					".md",
				);
				noteRecords.push({
					section,
					source: sourceFile,
					destination: path.join(destinationRoot, relativeDestination),
					slug: `notes/${toPosix(relativeDestination).replace(/\.md$/i, "")}`,
				});
			} else if (mediaExtensions.has(extension)) {
				assetRecords.push({
					section,
					source: sourceFile,
					destination: path.join(
						destinationRoot,
						destinationRelativePath(section, sourceFile, extension),
					),
				});
			}
		}
	}

	const duplicateSlugs = noteRecords
		.map((record) => record.slug)
		.filter((slug, index, all) => all.indexOf(slug) !== index);
	if (duplicateSlugs.length > 0) {
		throw new Error(`Duplicate generated note slugs: ${duplicateSlugs.join(", ")}`);
	}

	const noteBySource = new Map(
		noteRecords.map((record) => [pathKey(record.source), record]),
	);
	const assetBySource = new Map(
		assetRecords.map((record) => [pathKey(record.source), record]),
	);
	const notesByName = new Map();
	const assetsByName = new Map();
	for (const record of noteRecords) {
		const name = lookupName(
			path.basename(record.source, path.extname(record.source)),
		);
		notesByName.set(name, [...(notesByName.get(name) || []), record]);
	}
	for (const record of assetRecords) {
		const name = lookupName(
			path.basename(record.source, path.extname(record.source)),
		);
		assetsByName.set(name, [...(assetsByName.get(name) || []), record]);
	}
	const maps = { noteBySource, assetBySource, notesByName, assetsByName };

	await fs.rm(legacyDestinationRoot, { recursive: true, force: true });
	await fs.rm(templateGuideRoot, { recursive: true, force: true });
	await fs.rm(destinationRoot, { recursive: true, force: true });
	await fs.mkdir(destinationRoot, { recursive: true });

	for (const asset of assetRecords) {
		await fs.mkdir(path.dirname(asset.destination), { recursive: true });
		await fs.copyFile(asset.source, asset.destination);
	}

	for (const note of noteRecords) {
		const original = await fs.readFile(note.source, "utf8");
		const rewritten = rewriteLinks(
			original,
			note.source,
			note.destination,
			maps,
		).replace(/^(\s*```+)output\s*$/gim, "$1text");
		const title = path.basename(note.source, path.extname(note.source));
		const sourcePath = toPosix(path.relative(sourceRoot, note.source));
		const { published, updated } = await gitDatesFor(note.source);
		const tags = tagsFor(note.section, sourcePath, title);
		const frontmatter = [
			"---",
			`title: ${JSON.stringify(title)}`,
			`published: ${published}`,
			`updated: ${updated}`,
			"description: \"\"",
			`tags: ${JSON.stringify(tags)}`,
			`category: ${JSON.stringify(note.section.label)}`,
			"draft: false",
			`section: ${JSON.stringify(note.section.label)}`,
			`sectionSlug: ${JSON.stringify(note.section.slug)}`,
			`sectionOrder: ${note.section.order}`,
			`sourcePath: ${JSON.stringify(sourcePath)}`,
			"---",
			"",
		].join("\n");
		await fs.mkdir(path.dirname(note.destination), { recursive: true });
		await fs.writeFile(note.destination, `${frontmatter}${rewritten}`, "utf8");
	}

	console.log(
		`Synced ${noteRecords.length} notes and ${assetRecords.length} media files from ${sourceRoot}.`,
	);
}

await main();
