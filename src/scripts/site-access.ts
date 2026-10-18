const ACCESS_CHECK_INTERVAL = 10_000;

let accessCheckTimer: number | null = null;
let accessCheckPending = false;

async function checkSiteAccess() {
	if (accessCheckPending) return;
	accessCheckPending = true;
	try {
		const response = await fetch("/api/site-access", { cache: "no-store" });
		if (response.status === 403) window.location.reload();
	} catch {
		// A transient network error must not replace the current page.
	} finally {
		accessCheckPending = false;
	}
}

export function startSiteAccessMonitor() {
	if (
		accessCheckTimer !== null ||
		window.location.pathname.replace(/\/+$/u, "") === "/login"
	) {
		return;
	}
	accessCheckTimer = window.setInterval(
		() => void checkSiteAccess(),
		ACCESS_CHECK_INTERVAL,
	);
	window.addEventListener("focus", () => void checkSiteAccess());
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") void checkSiteAccess();
	});
}
