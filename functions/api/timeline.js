import { json } from "../../server/auth.js";
import { customTimelineEvent } from "../../server/timeline.js";

export async function onRequestGet(context) {
	try {
		const [customResult, hiddenResult] = await context.env.DB.batch([
			context.env.DB.prepare(
				`SELECT id, title, created_at
				 FROM public_timeline_events
				 WHERE status = 'published'
				 ORDER BY created_at DESC, id ASC`,
			),
			context.env.DB.prepare("SELECT event_id FROM hidden_timeline_events"),
		]);
		return json({
			events: (customResult.results || []).map(customTimelineEvent),
			hiddenEventIds: (hiddenResult.results || []).map(
				(row) => row.event_id,
			),
		});
	} catch (error) {
		console.error("Timeline lookup failed:", error.message);
		return json({ error: "公开时间线读取失败，请确认数据库迁移已执行。" }, 500);
	}
}
