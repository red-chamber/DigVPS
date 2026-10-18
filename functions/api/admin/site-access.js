import {
	json,
	readJson,
	recordActivity,
	requestHasSameOrigin,
} from "../../../server/auth.js";
import {
	loadSiteAccess,
	updateSiteAccess,
} from "../../../server/site-access.js";

function requireAdmin(context) {
	if (!context.data?.user) return json({ error: "尚未登录。" }, 401);
	if (context.data.user.role !== "admin") {
		return json({ error: "仅管理员可以控制全站访问。" }, 403);
	}
	return null;
}

export async function onRequestGet(context) {
	const denied = requireAdmin(context);
	if (denied) return denied;
	try {
		return json({ state: await loadSiteAccess(context.env.DB) });
	} catch (error) {
		console.error("Site access lookup failed:", error.message);
		return json({ error: "全站访问状态读取失败。" }, 500);
	}
}

export async function onRequestPost(context) {
	const denied = requireAdmin(context);
	if (denied) return denied;
	if (!requestHasSameOrigin(context.request)) {
		return json({ error: "请求来源无效。" }, 403);
	}
	let body;
	try {
		body = await readJson(context.request);
	} catch (error) {
		return json({ error: error.message || "请求格式无效。" }, 400);
	}
	if (typeof body.paused !== "boolean") {
		return json({ error: "访问状态无效。" }, 400);
	}

	try {
		const updatedAt = Math.floor(Date.now() / 1000);
		const state = await updateSiteAccess(
			context.env.DB,
			body.paused,
			context.data.user.id,
			updatedAt,
		);
		await recordActivity(context, {
			userId: context.data.user.id,
			eventType: body.paused ? "site_access_paused" : "site_access_resumed",
			path: "/account/#admin-access-panel",
		});
		return json({ ok: true, state });
	} catch (error) {
		console.error("Site access update failed:", error.message);
		return json({ error: "全站访问状态更新失败。" }, 500);
	}
}
