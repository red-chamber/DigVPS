const boundLogoutButtons = new WeakSet<HTMLButtonElement>();
const loadingAccountPages = new WeakSet<HTMLElement>();

export function initAccountPage() {
	const root = document.querySelector<HTMLElement>("#account-page");
	if (!root) return;

	const loading = root.querySelector<HTMLElement>("#account-loading");
	const details = root.querySelector<HTMLElement>("#account-details");
	const email = root.querySelector<HTMLElement>("#account-email");
	const role = root.querySelector<HTMLElement>("#account-role");
	const expiry = root.querySelector<HTMLElement>("#account-expiry");
	const message = root.querySelector<HTMLElement>("#account-message");
	const logout = root.querySelector<HTMLButtonElement>("#logout-button");

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

	if (loadingAccountPages.has(root)) return;
	loadingAccountPages.add(root);
	if (loading) {
		loading.textContent = "正在读取账户信息……";
		loading.classList.remove("hidden");
	}
	details?.classList.add("hidden");

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
		} catch (error) {
			if (loading) {
				loading.textContent =
					error instanceof Error ? error.message : "账户信息读取失败。";
			}
		} finally {
			loadingAccountPages.delete(root);
		}
	})();
}
