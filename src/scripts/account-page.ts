const boundLogoutButtons = new WeakSet<HTMLButtonElement>();
const boundAdminButtons = new WeakSet<HTMLButtonElement>();
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
	active_sessions: number;
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
		activeSessions: number;
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
	page_view: "访问页面",
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
		appendCell(row, String(user.active_sessions || 0));
		body.append(row);
	}
	if (users.length === 0) {
		const row = document.createElement("tr");
		const cell = document.createElement("td");
		cell.colSpan = 5;
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
			const activeSessions = root.querySelector<HTMLElement>(
				"#admin-active-sessions",
			);
			if (totalUsers)
				totalUsers.textContent = String(result.summary.totalUsers);
			if (verifiedUsers)
				verifiedUsers.textContent = String(result.summary.verifiedUsers);
			if (activeSessions)
				activeSessions.textContent = String(result.summary.activeSessions);
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
	const adminPanel = root.querySelector<HTMLElement>("#admin-activity-panel");

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
	adminPanel?.classList.add("hidden");

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

			if (result.user.role === "admin" && adminPanel) {
				adminPanel.classList.remove("hidden");
				bindAdminButtons(root);
				await loadAdminActivity(root);
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
