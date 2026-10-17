import { invalidatePublishedNotes } from "./published-notes";
import { invalidateTimelineData } from "./timeline-data";

const boundLogoutButtons = new WeakSet<HTMLButtonElement>();
const boundAdminButtons = new WeakSet<HTMLButtonElement>();
const boundAdminToolRoots = new WeakSet<HTMLElement>();
const loadingAccountPages = new WeakSet<HTMLElement>();

interface AdminUser {
	id: string;
	email: string;
	username?: string | null;
	role: "user" | "admin";
	email_verified: number;
	created_at: number;
	locked_until?: number | null;
	failed_login_count: number;
	last_activity_at?: number | null;
}

interface UserActivity {
	id: number;
	user_id?: string | null;
	email?: string | null;
	username?: string | null;
	role?: "user" | "admin" | null;
	event_type: string;
	path?: string | null;
	ip_hash?: string | null;
	user_agent?: string | null;
	created_at: number;
}

interface ActivityResponse {
	users: AdminUser[];
	activities: UserActivity[];
	nextCursor?: number | null;
	summary: {
		totalUsers: number;
		verifiedUsers: number;
	};
	error?: string;
}

const activityLabels: Record<string, string> = {
	registration_requested: "申请注册",
	email_verified: "邮箱验证成功",
	login_success: "登录成功",
	login_failed: "登录失败",
	login_unverified: "未验证登录",
	logout: "退出登录",
	comment_submitted: "提交评论",
	comment_approved: "接纳评论",
	comment_rejected: "驳回评论",
	note_published: "发布笔记",
	note_deleted: "删除笔记",
	note_liked: "点赞笔记",
	account_deleted: "注销账户",
	timeline_event_published: "发布公开活动",
	timeline_event_deleted: "删除公开活动",
};

function formatTimestamp(value?: number | null) {
	return value ? new Date(value * 1000).toLocaleString("zh-CN") : "—";
}

function appendCell(row: HTMLTableRowElement, value: string, className = "") {
	const cell = document.createElement("td");
	cell.className = `px-4 py-3 align-top text-black/65 ${className}`;
	cell.textContent = value;
	row.append(cell);
}

function clientSummary(userAgent?: string | null, ipHash?: string | null) {
	const source = userAgent || "未知客户端";
	let device = "其他客户端";
	if (/Mobile|Android|iPhone|iPad/iu.test(source)) device = "移动设备";
	else if (/Windows/iu.test(source)) device = "Windows";
	else if (/Macintosh|Mac OS/iu.test(source)) device = "macOS";
	else if (/Linux/iu.test(source)) device = "Linux";
	const browser = /Edg\//iu.test(source)
		? "Edge"
		: /Chrome\//iu.test(source)
			? "Chrome"
			: /Firefox\//iu.test(source)
				? "Firefox"
				: /Safari\//iu.test(source)
					? "Safari"
					: "";
	return `${device}${browser ? ` · ${browser}` : ""}${ipHash ? ` · ${ipHash}` : ""}`;
}

function renderUsers(root: HTMLElement, users: AdminUser[]) {
	const body = root.querySelector<HTMLTableSectionElement>("#admin-users-body");
	if (!body) return;
	body.replaceChildren();
	for (const user of users) {
		const row = document.createElement("tr");
		appendCell(
			row,
			user.username ? `${user.username}\n${user.email}` : user.email,
			"whitespace-pre-line",
		);
		const now = Date.now() / 1000;
		const state =
			user.locked_until && user.locked_until > now
				? "已锁定"
				: user.email_verified
					? user.role === "admin"
						? "管理员"
						: "已验证"
					: "待验证";
		appendCell(row, state);
		appendCell(row, formatTimestamp(user.created_at), "whitespace-nowrap");
		appendCell(
			row,
			formatTimestamp(user.last_activity_at),
			"whitespace-nowrap",
		);
		body.append(row);
	}
	if (users.length === 0) {
		const row = document.createElement("tr");
		const cell = document.createElement("td");
		cell.colSpan = 4;
		cell.className = "px-4 py-6 text-center text-black/45";
		cell.textContent = "暂无用户";
		row.append(cell);
		body.append(row);
	}
}

function renderActivities(
	root: HTMLElement,
	activities: UserActivity[],
	append: boolean,
) {
	const body = root.querySelector<HTMLTableSectionElement>(
		"#admin-activities-body",
	);
	if (!body) return;
	if (!append) body.replaceChildren();
	for (const activity of activities) {
		const row = document.createElement("tr");
		appendCell(row, formatTimestamp(activity.created_at), "whitespace-nowrap");
		appendCell(
			row,
			activity.username || activity.email || activity.user_id || "未知用户",
		);
		appendCell(
			row,
			activityLabels[activity.event_type] || activity.event_type,
			"whitespace-nowrap",
		);
		appendCell(row, activity.path || "—", "max-w-64 break-all");
		appendCell(
			row,
			clientSummary(activity.user_agent, activity.ip_hash),
			"whitespace-nowrap",
		);
		body.append(row);
	}
	if (!append && activities.length === 0) {
		const row = document.createElement("tr");
		const cell = document.createElement("td");
		cell.colSpan = 5;
		cell.className = "px-4 py-6 text-center text-black/45";
		cell.textContent = "暂无活动记录";
		row.append(cell);
		body.append(row);
	}
}

async function loadAdminActivity(root: HTMLElement, append = false) {
	const panel = root.querySelector<HTMLElement>("#admin-activity-panel");
	const loading = root.querySelector<HTMLElement>("#admin-activity-loading");
	const content = root.querySelector<HTMLElement>("#admin-activity-content");
	const message = root.querySelector<HTMLElement>("#admin-activity-message");
	const more = root.querySelector<HTMLButtonElement>("#admin-activity-more");
	const refresh = root.querySelector<HTMLButtonElement>(
		"#admin-activity-refresh",
	);
	if (!panel) return;

	const cursor = append ? panel.dataset.nextCursor : null;
	const query = new URLSearchParams({ limit: "50" });
	if (cursor) query.set("cursor", cursor);
	if (!append) {
		loading?.classList.remove("hidden");
		content?.classList.add("hidden");
	}
	message?.classList.add("hidden");
	if (more) more.disabled = true;
	if (refresh) refresh.disabled = true;

	try {
		const response = await fetch(`/api/admin/activity?${query}`, {
			cache: "no-store",
		});
		const result = (await response.json()) as ActivityResponse;
		if (!response.ok) throw new Error(result.error || "用户活动读取失败。");

		if (!append) {
			const totalUsers = root.querySelector<HTMLElement>("#admin-total-users");
			const verifiedUsers = root.querySelector<HTMLElement>(
				"#admin-verified-users",
			);
			if (totalUsers)
				totalUsers.textContent = String(result.summary.totalUsers);
			if (verifiedUsers)
				verifiedUsers.textContent = String(result.summary.verifiedUsers);
			renderUsers(root, result.users);
		}
		renderActivities(root, result.activities, append);
		panel.dataset.nextCursor = result.nextCursor
			? String(result.nextCursor)
			: "";
		more?.classList.toggle("hidden", !result.nextCursor);
		loading?.classList.add("hidden");
		content?.classList.remove("hidden");
	} catch (error) {
		if (message) {
			message.textContent =
				error instanceof Error ? error.message : "用户活动读取失败。";
			message.classList.remove("hidden");
		}
		loading?.classList.add("hidden");
	} finally {
		if (more) more.disabled = false;
		if (refresh) refresh.disabled = false;
	}
}

function bindAdminButtons(root: HTMLElement) {
	const refresh = root.querySelector<HTMLButtonElement>(
		"#admin-activity-refresh",
	);
	const more = root.querySelector<HTMLButtonElement>("#admin-activity-more");
	for (const button of [refresh, more]) {
		if (!button || boundAdminButtons.has(button)) continue;
		boundAdminButtons.add(button);
		button.addEventListener("click", () => {
			void loadAdminActivity(root, button === more);
		});
	}
}

function setAdminMessage(
	element: HTMLElement | null,
	text: string,
	error = false,
) {
	if (!element) return;
	element.textContent = text;
	element.classList.toggle("hidden", !text);
	element.className = `${text ? "" : "hidden "}rounded-lg border px-4 py-3 text-sm ${
		error
			? "border-red-200 bg-red-50 text-red-700"
			: "border-emerald-200 bg-emerald-50 text-emerald-700"
	}`;
}

interface PendingComment {
	id: string;
	note_key: string;
	note_title: string;
	author_name: string;
	email?: string | null;
	content: string;
	created_at: number;
}

interface AdminNote {
	key: string;
	type: "static" | "dynamic";
	title: string;
	description: string;
	category: string;
	tags: string[];
	publishedAt?: number | null;
	path: string;
}

interface AdminTimelineEvent {
	id: string;
	title: string;
	date: number;
	action: "published" | "updated" | "activity";
	source: "static" | "dynamic" | "archived" | "custom";
	available: boolean;
}

const timelineSourceLabels: Record<AdminTimelineEvent["source"], string> = {
	static: "仓库笔记",
	dynamic: "在线笔记",
	archived: "历史笔记",
	custom: "手动活动",
};

function renderAdminTimeline(root: HTMLElement, events: AdminTimelineEvent[]) {
	const list = root.querySelector<HTMLElement>("#admin-timeline-list");
	if (!list) return;
	list.replaceChildren();
	if (!events.length) {
		const empty = document.createElement("p");
		empty.className =
			"rounded-lg bg-[var(--btn-regular-bg)] px-4 py-5 text-center text-black/50";
		empty.textContent = "公开时间线暂无活动";
		list.append(empty);
		return;
	}
	for (const event of events) {
		const article = document.createElement("article");
		article.dataset.timelineEventId = event.id;
		article.dataset.deletesNote = String(
			event.available &&
				(event.source === "static" || event.source === "dynamic"),
		);
		article.className =
			"flex flex-col gap-3 rounded-xl border border-[var(--line-color)] bg-white/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between";
		const body = document.createElement("div");
		body.className = "min-w-0";
		const title = document.createElement("p");
		title.className = "break-words font-bold text-black/80";
		title.textContent = event.title;
		const meta = document.createElement("p");
		meta.className = "mt-1 text-xs text-black/45";
		const action =
			event.action === "updated"
				? "修改"
				: event.action === "activity"
					? "活动"
					: "提交";
		meta.textContent = `${formatTimestamp(event.date)} · ${timelineSourceLabels[event.source]} · ${action}${event.available ? "" : " · 笔记已删除"}`;
		body.append(title, meta);
		const remove = document.createElement("button");
		remove.type = "button";
		remove.dataset.deleteTimelineEvent = "";
		remove.className =
			"shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100";
		remove.textContent =
			article.dataset.deletesNote === "true" ? "删除笔记及记录" : "删除记录";
		article.append(body, remove);
		list.append(article);
	}
}

async function loadAdminTimeline(root: HTMLElement) {
	const refresh = root.querySelector<HTMLButtonElement>(
		"#admin-timeline-refresh",
	);
	const message = root.querySelector<HTMLElement>("#admin-timeline-message");
	if (refresh) refresh.disabled = true;
	setAdminMessage(message, "");
	try {
		const response = await fetch("/api/admin/timeline", { cache: "no-store" });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "公开时间线读取失败。");
		renderAdminTimeline(root, result.events || []);
	} catch (error) {
		setAdminMessage(
			message,
			error instanceof Error ? error.message : "公开时间线读取失败。",
			true,
		);
	} finally {
		if (refresh) refresh.disabled = false;
	}
}

function setAdminSectionExpanded(section: HTMLElement, expanded: boolean) {
	section
		.querySelector<HTMLElement>("[data-admin-section-content]")
		?.classList.toggle("hidden", !expanded);
	const button = section.querySelector<HTMLButtonElement>(
		"button[data-admin-collapse]",
	);
	if (button) {
		button.setAttribute("aria-expanded", String(expanded));
		button.textContent = expanded ? "收起" : "展开";
	}
}

function renderAdminNotes(root: HTMLElement, notes: AdminNote[]) {
	const list = root.querySelector<HTMLElement>("#admin-notes-list");
	if (!list) return;
	list.replaceChildren();
	if (!notes.length) {
		const empty = document.createElement("p");
		empty.className =
			"rounded-lg bg-[var(--btn-regular-bg)] px-4 py-5 text-center text-black/50";
		empty.textContent = "暂无笔记";
		list.append(empty);
		return;
	}
	for (const note of notes) {
		const article = document.createElement("article");
		article.className =
			"flex flex-col gap-3 rounded-xl border border-[var(--line-color)] bg-white/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between";
		article.dataset.noteKey = note.key;
		const body = document.createElement("div");
		body.className = "min-w-0";
		const title = document.createElement("a");
		title.href = note.path;
		title.className =
			"font-bold text-black/80 transition hover:text-[var(--primary)]";
		title.textContent = note.title;
		const meta = document.createElement("p");
		meta.className = "mt-1 truncate text-xs text-black/45";
		meta.textContent = [
			note.type === "dynamic" ? "在线发布" : "仓库笔记",
			note.category || "未分类",
			...note.tags.map((tag) => `#${tag}`),
		].join(" · ");
		body.append(title, meta);
		const remove = document.createElement("button");
		remove.type = "button";
		remove.dataset.deleteNote = "";
		remove.className =
			"shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100";
		remove.textContent = "删除";
		article.append(body, remove);
		list.append(article);
	}
}

async function loadAdminNotes(root: HTMLElement) {
	const refresh = root.querySelector<HTMLButtonElement>("#admin-notes-refresh");
	const message = root.querySelector<HTMLElement>("#admin-notes-message");
	if (refresh) refresh.disabled = true;
	setAdminMessage(message, "");
	try {
		const response = await fetch("/api/admin/notes", { cache: "no-store" });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "笔记列表读取失败。");
		renderAdminNotes(root, result.notes || []);
	} catch (error) {
		setAdminMessage(
			message,
			error instanceof Error ? error.message : "笔记列表读取失败。",
			true,
		);
	} finally {
		if (refresh) refresh.disabled = false;
	}
}

function renderPendingComments(root: HTMLElement, comments: PendingComment[]) {
	const list = root.querySelector<HTMLElement>("#admin-comments-list");
	if (!list) return;
	list.replaceChildren();
	if (!comments.length) {
		const empty = document.createElement("p");
		empty.className =
			"rounded-lg bg-[var(--btn-regular-bg)] px-4 py-5 text-center text-black/50";
		empty.textContent = "暂无待审核评论";
		list.append(empty);
		return;
	}
	for (const comment of comments) {
		const article = document.createElement("article");
		article.className =
			"rounded-xl border border-[var(--line-color)] bg-white/45 px-4 py-4";
		article.dataset.commentId = comment.id;
		const meta = document.createElement("p");
		meta.className = "text-sm text-black/50";
		meta.textContent = `${comment.note_title} · ${comment.author_name}${comment.email ? ` (${comment.email})` : ""} · ${formatTimestamp(comment.created_at)}`;
		const content = document.createElement("p");
		content.className = "mt-3 whitespace-pre-wrap break-words text-black/75";
		content.textContent = comment.content;
		const actions = document.createElement("div");
		actions.className = "mt-4 flex gap-2";
		for (const [action, label] of [
			["approve", "接纳"],
			["reject", "驳回"],
		] as const) {
			const button = document.createElement("button");
			button.type = "button";
			button.dataset.moderationAction = action;
			button.className =
				action === "approve"
					? "btn-regular rounded-lg px-4 py-2 text-sm font-bold"
					: "rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100";
			button.textContent = label;
			actions.append(button);
		}
		article.append(meta, content, actions);
		list.append(article);
	}
}

async function loadPendingComments(root: HTMLElement) {
	const refresh = root.querySelector<HTMLButtonElement>(
		"#admin-comments-refresh",
	);
	const message = root.querySelector<HTMLElement>("#admin-comments-message");
	if (refresh) refresh.disabled = true;
	setAdminMessage(message, "");
	try {
		const response = await fetch("/api/admin/comments", { cache: "no-store" });
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "待审核评论读取失败。");
		renderPendingComments(root, result.comments || []);
	} catch (error) {
		setAdminMessage(
			message,
			error instanceof Error ? error.message : "待审核评论读取失败。",
			true,
		);
	} finally {
		if (refresh) refresh.disabled = false;
	}
}

function bindAdminTools(root: HTMLElement) {
	if (boundAdminToolRoots.has(root)) return;
	boundAdminToolRoots.add(root);
	const commentPanel = root.querySelector<HTMLElement>("#admin-comments-panel");
	const commentMessage = root.querySelector<HTMLElement>(
		"#admin-comments-message",
	);
	root
		.querySelector<HTMLButtonElement>("#admin-comments-refresh")
		?.addEventListener("click", () => void loadPendingComments(root));
	root
		.querySelector<HTMLButtonElement>("#admin-notes-refresh")
		?.addEventListener("click", () => void loadAdminNotes(root));
	root
		.querySelector<HTMLButtonElement>("#admin-timeline-refresh")
		?.addEventListener("click", () => void loadAdminTimeline(root));
	root.addEventListener("click", (event) => {
		const target = event.target as Element | null;
		const collapse = target?.closest<HTMLButtonElement>(
			"button[data-admin-collapse]",
		);
		if (collapse) {
			const section = collapse.closest<HTMLElement>("[data-admin-section]");
			if (section) {
				setAdminSectionExpanded(
					section,
					collapse.getAttribute("aria-expanded") !== "true",
				);
			}
			return;
		}
		const navigation = target?.closest<HTMLAnchorElement>(
			"#admin-section-nav a[href^='#']",
		);
		if (!navigation) return;
		const section = root.querySelector<HTMLElement>(navigation.hash);
		if (section?.matches("[data-admin-section]")) {
			setAdminSectionExpanded(section, true);
		}
	});

	const timelinePanel = root.querySelector<HTMLElement>(
		"#admin-timeline-panel",
	);
	const timelineMessage = root.querySelector<HTMLElement>(
		"#admin-timeline-message",
	);
	timelinePanel?.addEventListener("click", async (event) => {
		const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
			"button[data-delete-timeline-event]",
		);
		if (!button) return;
		const article = button.closest<HTMLElement>("[data-timeline-event-id]");
		const eventId = article?.dataset.timelineEventId;
		const title = article?.querySelector("p")?.textContent?.trim() || "这条活动";
		if (!eventId) return;
		const deletesNote = article.dataset.deletesNote === "true";
		const confirmation = deletesNote
			? `确定删除“${title}”吗？对应笔记也会被删除。`
			: `确定从公开时间线删除“${title}”吗？`;
		if (!window.confirm(confirmation)) {
			return;
		}
		button.disabled = true;
		setAdminMessage(timelineMessage, "");
		try {
			const response = await fetch("/api/admin/timeline", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ eventId }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "公开活动删除失败。");
			invalidateTimelineData();
			if (result.noteDeleted) {
				invalidatePublishedNotes();
				void loadAdminNotes(root);
			}
			await loadAdminTimeline(root);
			setAdminMessage(
				timelineMessage,
				result.noteDeleted
					? `“${result.noteTitle || title}”及所选时间线记录已删除。`
					: "该活动已从公开时间线删除。",
			);
			void loadAdminActivity(root);
		} catch (error) {
			setAdminMessage(
				timelineMessage,
				error instanceof Error ? error.message : "公开活动删除失败。",
				true,
			);
			button.disabled = false;
		}
	});
	const notesPanel = root.querySelector<HTMLElement>("#admin-notes-panel");
	const notesMessage = root.querySelector<HTMLElement>("#admin-notes-message");
	notesPanel?.addEventListener("click", async (event) => {
		const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
			"button[data-delete-note]",
		);
		if (!button) return;
		const article = button.closest<HTMLElement>("[data-note-key]");
		const title =
			article?.querySelector("a")?.textContent?.trim() || "这篇笔记";
		if (!article?.dataset.noteKey) return;
		if (!window.confirm(`确定删除“${title}”吗？删除后将不再公开显示。`)) {
			return;
		}
		button.disabled = true;
		setAdminMessage(notesMessage, "");
		try {
			const response = await fetch("/api/admin/notes", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ noteKey: article.dataset.noteKey }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "笔记删除失败。");
			article.remove();
			if (!notesPanel.querySelector("[data-note-key]")) {
				renderAdminNotes(root, []);
			}
			invalidatePublishedNotes();
			setAdminMessage(notesMessage, `已删除“${result.title || title}”。`);
			void loadAdminTimeline(root);
			void loadAdminActivity(root);
		} catch (error) {
			setAdminMessage(
				notesMessage,
				error instanceof Error ? error.message : "笔记删除失败。",
				true,
			);
			button.disabled = false;
		}
	});
	commentPanel?.addEventListener("click", async (event) => {
		const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
			"button[data-moderation-action]",
		);
		if (!button) return;
		const article = button.closest<HTMLElement>("[data-comment-id]");
		if (!article?.dataset.commentId) return;
		for (const actionButton of article.querySelectorAll<HTMLButtonElement>(
			"button",
		)) {
			actionButton.disabled = true;
		}
		try {
			const response = await fetch("/api/admin/comments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: article.dataset.commentId,
					action: button.dataset.moderationAction,
				}),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "评论审核失败。");
			article.remove();
			if (!commentPanel.querySelector("[data-comment-id]")) {
				renderPendingComments(root, []);
			}
			setAdminMessage(
				commentMessage,
				result.status === "approved" ? "评论已接纳。" : "评论已驳回。",
			);
			void loadAdminActivity(root);
		} catch (error) {
			setAdminMessage(
				commentMessage,
				error instanceof Error ? error.message : "评论审核失败。",
				true,
			);
			for (const actionButton of article.querySelectorAll<HTMLButtonElement>(
				"button",
			)) {
				actionButton.disabled = false;
			}
		}
	});

	const form = root.querySelector<HTMLFormElement>("#admin-note-form");
	form?.addEventListener("submit", async (event) => {
		event.preventDefault();
		const submit = root.querySelector<HTMLButtonElement>("#admin-note-submit");
		const message = root.querySelector<HTMLElement>("#admin-note-message");
		const value = (selector: string) =>
			root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
				?.value || "";
		if (submit) submit.disabled = true;
		setAdminMessage(message, "");
		try {
			const response = await fetch("/api/admin/notes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: value("#admin-note-title"),
					slug: value("#admin-note-slug"),
					description: value("#admin-note-description"),
					category: value("#admin-note-category"),
					tags: value("#admin-note-tags")
						.split(/[，,]/u)
						.map((tag) => tag.trim())
						.filter(Boolean),
					markdown: value("#admin-note-markdown"),
				}),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "笔记发布失败。");
			invalidatePublishedNotes();
			form.reset();
			void loadAdminNotes(root);
			void loadAdminTimeline(root);
			setAdminMessage(message, "笔记已发布。");
			if (message) {
				const link = document.createElement("a");
				link.href = result.path;
				link.className = "ml-2 font-bold underline";
				link.textContent = "打开笔记";
				message.append(link);
			}
			void loadAdminActivity(root);
		} catch (error) {
			setAdminMessage(
				message,
				error instanceof Error ? error.message : "笔记发布失败。",
				true,
			);
		} finally {
			if (submit) submit.disabled = false;
		}
	});

	const timelineForm = root.querySelector<HTMLFormElement>(
		"#admin-timeline-form",
	);
	timelineForm?.addEventListener("submit", async (event) => {
		event.preventDefault();
		const title = root.querySelector<HTMLInputElement>(
			"#admin-timeline-title",
		);
		const submit = root.querySelector<HTMLButtonElement>(
			"#admin-timeline-submit",
		);
		const message = root.querySelector<HTMLElement>("#admin-timeline-message");
		if (submit) submit.disabled = true;
		setAdminMessage(message, "");
		try {
			const response = await fetch("/api/admin/timeline", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: title?.value || "" }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "公开活动发布失败。");
			timelineForm.reset();
			invalidateTimelineData();
			await loadAdminTimeline(root);
			setAdminMessage(message, "公开活动已发布。");
			void loadAdminActivity(root);
		} catch (error) {
			setAdminMessage(
				message,
				error instanceof Error ? error.message : "公开活动发布失败。",
				true,
			);
		} finally {
			if (submit) submit.disabled = false;
		}
	});
}

export function initAccountPage() {
	const page = document.querySelector<HTMLElement>("#account-page");
	if (!page) return;
	const root = page.parentElement || page;

	const loading = root.querySelector<HTMLElement>("#account-loading");
	const details = root.querySelector<HTMLElement>("#account-details");
	const email = root.querySelector<HTMLElement>("#account-email");
	const role = root.querySelector<HTMLElement>("#account-role");
	const expiry = root.querySelector<HTMLElement>("#account-expiry");
	const message = root.querySelector<HTMLElement>("#account-message");
	const logout = root.querySelector<HTMLButtonElement>("#logout-button");
	const adminSections = root.querySelectorAll<HTMLElement>(
		"[data-admin-section]",
	);
	const adminNavigation = root.querySelector<HTMLElement>(
		"#admin-section-nav",
	);

	if (logout && !boundLogoutButtons.has(logout)) {
		boundLogoutButtons.add(logout);
		logout.addEventListener("click", async () => {
			logout.disabled = true;
			message?.classList.add("hidden");
			try {
				const response = await fetch("/api/auth/logout", { method: "POST" });
				const result = await response.json();
				if (!response.ok) throw new Error(result.error || "退出失败。");
				window.location.assign("/login/");
			} catch (error) {
				if (message) {
					message.textContent =
						error instanceof Error ? error.message : "退出失败。";
					message.classList.remove("hidden");
				}
			} finally {
				logout.disabled = false;
			}
		});
	}

	if (loadingAccountPages.has(page)) return;
	loadingAccountPages.add(page);
	if (loading) {
		loading.textContent = "正在读取账户信息……";
		loading.classList.remove("hidden");
	}
	details?.classList.add("hidden");
	adminNavigation?.classList.add("hidden");
	for (const section of adminSections) section.classList.add("hidden");

	void (async () => {
		try {
			const response = await fetch("/api/auth/me", { cache: "no-store" });
			if (response.status === 401) {
				window.location.assign("/login/");
				return;
			}
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "账户信息读取失败。");
			if (email) email.textContent = result.user.email;
			if (role)
				role.textContent = result.user.role === "admin" ? "管理员" : "普通用户";
			if (expiry)
				expiry.textContent = new Date(result.expiresAt * 1000).toLocaleString(
					"zh-CN",
				);
			loading?.classList.add("hidden");
			details?.classList.remove("hidden");

			if (result.user.role === "admin" && adminSections.length) {
				adminNavigation?.classList.remove("hidden");
				for (const section of adminSections) section.classList.remove("hidden");
				bindAdminButtons(root);
				bindAdminTools(root);
				await Promise.all([
					loadAdminActivity(root),
					loadAdminTimeline(root),
					loadAdminNotes(root),
					loadPendingComments(root),
				]);
			}
		} catch (error) {
			if (loading) {
				loading.textContent =
					error instanceof Error ? error.message : "账户信息读取失败。";
			}
		} finally {
			loadingAccountPages.delete(page);
		}
	})();
}
