const boundInteractions = new WeakSet<HTMLElement>();

interface NoteComment {
	id: string;
	author_name: string;
	content: string;
	created_at: number;
}

function setMessage(root: HTMLElement, text: string, error = false) {
	const message = root.querySelector<HTMLElement>(".note-interaction-message");
	if (!message) return;
	message.textContent = text;
	message.classList.toggle("hidden", !text);
	message.className = `note-interaction-message mt-4 rounded-lg px-4 py-3 text-sm ${
		error
			? "border border-red-200 bg-red-50 text-red-700"
			: "border border-emerald-200 bg-emerald-50 text-emerald-700"
	}`;
}

function renderComments(root: HTMLElement, comments: NoteComment[]) {
	const container = root.querySelector<HTMLElement>(".note-comments");
	if (!container) return;
	container.replaceChildren();
	if (comments.length === 0) {
		const empty = document.createElement("p");
		empty.className = "text-sm text-black/45";
		empty.textContent = "还没有已通过的评论。";
		container.append(empty);
		return;
	}
	for (const comment of comments) {
		const article = document.createElement("article");
		article.className =
			"rounded-xl border border-[var(--line-color)] bg-white/45 px-4 py-3";
		const header = document.createElement("div");
		header.className = "flex flex-wrap items-center justify-between gap-2";
		const author = document.createElement("strong");
		author.className = "text-sm text-black/70";
		author.textContent = comment.author_name;
		const time = document.createElement("time");
		time.className = "text-xs text-black/40";
		time.textContent = new Date(comment.created_at * 1000).toLocaleString(
			"zh-CN",
		);
		const content = document.createElement("p");
		content.className = "mt-2 whitespace-pre-wrap break-words text-black/70";
		content.textContent = comment.content;
		header.append(author, time);
		article.append(header, content);
		container.append(article);
	}
}

async function loadInteractions(root: HTMLElement) {
	const noteKey = root.dataset.noteKey || "";
	if (!noteKey) return;
	try {
		const response = await fetch(
			`/api/note-interactions?note=${encodeURIComponent(noteKey)}`,
			{ cache: "no-store" },
		);
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "互动信息读取失败。");
		const button = root.querySelector<HTMLButtonElement>(".note-like-button");
		const label = root.querySelector<HTMLElement>(".note-like-label");
		const count = root.querySelector<HTMLElement>(".note-like-count");
		if (button) button.setAttribute("aria-pressed", String(result.liked));
		if (label) label.textContent = result.liked ? "已点赞" : "点赞";
		if (count) count.textContent = String(result.likeCount || 0);
		renderComments(root, result.comments || []);
	} catch (error) {
		renderComments(root, []);
		setMessage(
			root,
			error instanceof Error ? error.message : "互动信息读取失败。",
			true,
		);
	}
}

function bindInteraction(root: HTMLElement) {
	if (boundInteractions.has(root) || !root.dataset.noteKey) return;
	boundInteractions.add(root);
	const like = root.querySelector<HTMLButtonElement>(".note-like-button");
	const form = root.querySelector<HTMLFormElement>(".note-comment-form");
	const input = root.querySelector<HTMLTextAreaElement>(".note-comment-input");
	const characterCount = root.querySelector<HTMLElement>(".note-comment-count");
	input?.addEventListener("input", () => {
		const characters = Array.from(input.value);
		if (characters.length > 500)
			input.value = characters.slice(0, 500).join("");
		if (characterCount)
			characterCount.textContent = String(Array.from(input.value).length);
	});
	like?.addEventListener("click", async () => {
		like.disabled = true;
		setMessage(root, "");
		try {
			const response = await fetch("/api/note-like", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ note: root.dataset.noteKey }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "点赞失败。");
			like.setAttribute("aria-pressed", String(result.liked));
			const label = root.querySelector<HTMLElement>(".note-like-label");
			const count = root.querySelector<HTMLElement>(".note-like-count");
			if (label) label.textContent = result.liked ? "已点赞" : "点赞";
			if (count) count.textContent = String(result.likeCount || 0);
		} catch (error) {
			setMessage(
				root,
				error instanceof Error ? error.message : "点赞失败。",
				true,
			);
		} finally {
			like.disabled = false;
		}
	});
	form?.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!input) return;
		const submit = root.querySelector<HTMLButtonElement>(
			".note-comment-submit",
		);
		if (submit) submit.disabled = true;
		setMessage(root, "");
		try {
			const response = await fetch("/api/note-comments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					note: root.dataset.noteKey,
					content: input.value,
				}),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "评论提交失败。");
			input.value = "";
			if (characterCount) characterCount.textContent = "0";
			setMessage(root, result.message || "评论已提交审核。");
		} catch (error) {
			setMessage(
				root,
				error instanceof Error ? error.message : "评论提交失败。",
				true,
			);
		} finally {
			if (submit) submit.disabled = false;
		}
	});
	void loadInteractions(root);
}

export function initNoteInteractions(scope: ParentNode = document) {
	for (const root of scope.querySelectorAll<HTMLElement>(
		".note-interactions",
	)) {
		bindInteraction(root);
	}
}
