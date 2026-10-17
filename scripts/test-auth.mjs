import assert from "node:assert/strict";
import { onRequest as authMiddleware } from "../functions/_middleware.js";
import { onRequestGet as adminActivity } from "../functions/api/admin/activity.js";
import { onRequestPost as moderateComment } from "../functions/api/admin/comments.js";
import { onRequestPost as publishNote } from "../functions/api/admin/notes.js";
import {
	onRequestDelete as deleteTimelineEvent,
	onRequestPost as publishTimelineEvent,
} from "../functions/api/admin/timeline.js";
import { onRequestPost as submitComment } from "../functions/api/note-comments.js";
import {
	createSessionRecord,
	derivePasswordHash,
	hashPassword,
	randomVerificationCode,
	replaceUserSessionStatements,
	requestHasSameOrigin,
	SESSION_TTL_SECONDS,
	sessionCookie,
	verifyPassword,
} from "../server/auth.js";
import {
	renderMarkdown,
	resolvePublishedNote,
	prepareNoteDeletion,
	unicodeLength,
} from "../server/notes.js";

const testPassword = "unit-test-password";
const testCredential = await hashPassword(testPassword);
assert.equal(
	await verifyPassword(testPassword, testCredential.hash, testCredential.salt),
	true,
);
assert.equal(
	await verifyPassword("wrong", testCredential.hash, testCredential.salt),
	false,
);
assert.equal(
	await derivePasswordHash(testPassword, testCredential.salt),
	testCredential.hash,
);
assert.match(randomVerificationCode(), /^\d{6}$/u);
assert.equal(unicodeLength("a😀中"), 3);
assert.match(renderMarkdown("# Hello"), /<h1>Hello<\/h1>/u);
assert.match(renderMarkdown("<script>alert(1)</script>"), /&lt;script&gt;/u);
assert.equal(
	(await resolvePublishedNote({}, "static:notes/linux/全局"))?.type,
	"static",
);
assert.equal(await resolvePublishedNote({}, "static:notes/not-real"), null);
const staticResolvedNote = await resolvePublishedNote(
	{},
	"static:notes/linux/全局",
);
const staticDeletion = prepareNoteDeletion(
	{
		prepare(sql) {
			return {
				sql,
				bind(...values) {
					this.values = values;
					return this;
				},
			};
		},
	},
	staticResolvedNote,
	"admin-1",
	1_000,
);
assert.match(staticDeletion.statement.sql, /INSERT INTO deleted_static_notes/u);
assert.equal(staticDeletion.statement.values[0], "static:notes/linux/全局");

const session = await createSessionRecord("user-1", 1_000);
assert.equal(session.expiresAt, 1_000 + SESSION_TTL_SECONDS);
assert.match(sessionCookie(session.token), /Max-Age=259200/u);
assert.match(sessionCookie(session.token), /HttpOnly; Secure; SameSite=Lax/u);

const sessionSql = [];
const sessionBindings = [];
const replacementStatements = replaceUserSessionStatements(
	{
		prepare(sql) {
			sessionSql.push(sql);
			return {
				bind(...values) {
					sessionBindings.push(values);
					return { sql, values };
				},
			};
		},
	},
	session,
);
assert.equal(replacementStatements.length, 2);
assert.match(sessionSql[0], /DELETE FROM sessions WHERE user_id/u);
assert.match(sessionSql[1], /INSERT INTO sessions/u);
assert.deepEqual(sessionBindings[0], ["user-1"]);

assert.equal(
	requestHasSameOrigin(
		new Request("https://digvps.pages.dev/api/auth/login", {
			method: "POST",
			headers: { Origin: "https://digvps.pages.dev" },
		}),
	),
	true,
);
assert.equal(
	requestHasSameOrigin(
		new Request("https://digvps.pages.dev/api/auth/login", {
			method: "POST",
			headers: { Origin: "https://example.com" },
		}),
	),
	false,
);

function fakeDb(sessionRow = null) {
	return {
		prepare() {
			return {
				bind() {
					return {
						first: async () => sessionRow,
						run: async () => ({ success: true }),
					};
				},
			};
		},
	};
}

async function runMiddleware({ url, headers = {}, env = {}, row = null }) {
	return authMiddleware({
		request: new Request(url, { headers }),
		env: { ...env, DB: env.DB || fakeDb(row) },
		data: {},
		next: async () =>
			new Response("OK", {
				status: 200,
				headers: { "Content-Type": "text/html; charset=UTF-8" },
			}),
	});
}

const legacyDenied = await authMiddleware({
	request: new Request("https://cedrian.cn/"),
	env: {},
	data: {},
	next: async () => new Response("OK"),
});
assert.equal(legacyDenied.status, 401);

for (const alias of ["digvps.pages.dev", "www.cedrian.cn"]) {
	const redirect = await authMiddleware({
		request: new Request(`https://${alias}/notes/?tag=Linux`),
		env: {},
		data: {},
		next: async () => new Response("OK"),
	});
	assert.equal(redirect.status, 308);
	assert.equal(
		redirect.headers.get("Location"),
		"https://cedrian.cn/notes/?tag=Linux",
	);
}

const configuredEnv = {
	AUTH_SECRET: "test-secret-that-is-long-enough",
	BREVO_API_KEY: "test-key",
};

const publicLogin = await runMiddleware({
	url: "https://cedrian.cn/login/",
	env: configuredEnv,
});
assert.equal(publicLogin.status, 200);

const protectedPage = await runMiddleware({
	url: "https://cedrian.cn/notes/?page=1",
	env: configuredEnv,
});
assert.equal(protectedPage.status, 302);
assert.equal(
	new URL(protectedPage.headers.get("Location")).searchParams.get("next"),
	"/notes/?page=1",
);

const protectedApi = await runMiddleware({
	url: "https://cedrian.cn/api/auth/me",
	env: configuredEnv,
});
assert.equal(protectedApi.status, 401);

const validSession = await runMiddleware({
	url: "https://cedrian.cn/",
	headers: { Cookie: "digvps_session=test-token" },
	env: configuredEnv,
	row: {
		token_hash: "hash",
		expires_at: 2_000_000_000,
		id: "user-1",
		email: "reader@example.com",
		username: null,
		role: "user",
	},
});
assert.equal(validSession.status, 200);
assert.equal(validSession.headers.get("Cache-Control"), "private, no-store");

let authenticatedDbCalls = 0;
const noPageViewDb = {
	prepare() {
		authenticatedDbCalls += 1;
		return {
			bind() {
				return {
					first: async () => ({
						token_hash: "hash",
						expires_at: 2_000_000_000,
						id: "user-1",
						email: "reader@example.com",
						username: null,
						role: "user",
					}),
				};
			},
		};
	},
};
await runMiddleware({
	url: "https://cedrian.cn/notes/",
	headers: { Cookie: "digvps_session=test-token" },
	env: { ...configuredEnv, DB: noPageViewDb },
});
assert.equal(
	authenticatedDbCalls,
	1,
	"HTML GET must not create page_view activity",
);

const retiredWallpaper = await runMiddleware({
	url: "https://cedrian.cn/background/valley.jpg",
	env: configuredEnv,
});
assert.equal(retiredWallpaper.status, 404);

const regularUserActivity = await adminActivity({
	request: new Request("https://digvps.pages.dev/api/admin/activity"),
	data: { user: { id: "user-1", role: "user" } },
	env: { DB: {} },
});
assert.equal(regularUserActivity.status, 403);

const adminSql = [];
const adminActivityResponse = await adminActivity({
	request: new Request("https://digvps.pages.dev/api/admin/activity?limit=25"),
	data: { user: { id: "admin-1", role: "admin" } },
	env: {
		DB: {
			prepare(sql) {
				adminSql.push(sql);
				return {
					bind() {
						return this;
					},
				};
			},
			async batch() {
				return [
					{
						results: [
							{
								id: "admin-1",
								email: "admin@example.com",
								role: "admin",
								email_verified: 1,
							},
						],
					},
					{ results: [] },
				];
			},
		},
	},
});
assert.equal(adminActivityResponse.status, 200);
const adminActivityBody = await adminActivityResponse.json();
assert.equal(adminActivityBody.summary.totalUsers, 1);
assert.equal("activeSessions" in adminActivityBody.summary, false);
assert.match(adminSql[1], /event_type IN/u);
assert.doesNotMatch(adminSql[1], /page_view/u);

const regularPublish = await publishNote({
	request: new Request("https://digvps.pages.dev/api/admin/notes", {
		method: "POST",
	}),
	data: { user: { id: "user-1", role: "user" } },
});
assert.equal(regularPublish.status, 403);

const regularTimelinePublish = await publishTimelineEvent({
	request: new Request("https://digvps.pages.dev/api/admin/timeline", {
		method: "POST",
	}),
	data: { user: { id: "user-1", role: "user" } },
});
assert.equal(regularTimelinePublish.status, 403);

const timelineSql = [];
const timelineBindings = [];
const beforeTimelinePublish = Math.floor(Date.now() / 1000);
const adminTimelinePublish = await publishTimelineEvent({
	request: new Request("https://digvps.pages.dev/api/admin/timeline", {
		method: "POST",
		headers: {
			Origin: "https://digvps.pages.dev",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ title: "测试公开活动" }),
	}),
	data: { user: { id: "admin-1", role: "admin" } },
	env: {
		DB: {
			prepare(sql) {
				timelineSql.push(sql);
				return {
					bind(...values) {
						timelineBindings.push(values);
						return this;
					},
					async run() {
						return { success: true };
					},
				};
			},
		},
	},
});
assert.equal(adminTimelinePublish.status, 201);
const adminTimelineBody = await adminTimelinePublish.json();
assert.equal(adminTimelineBody.event.title, "测试公开活动");
assert.ok(adminTimelineBody.event.createdAt >= beforeTimelinePublish);
assert.match(timelineSql[0], /INSERT INTO public_timeline_events/u);
assert.equal(timelineBindings[0][1], "测试公开活动");

const timelineMutationBatches = [];
const dynamicTimelineRow = {
	slug: "test-note",
	title: "待删除笔记",
	description: "测试",
	category: "Test",
	tags_json: "[]",
	rendered_html: "<p>测试</p>",
	published_at: 100,
	updated_at: 100,
	status: "published",
};
const timelineDeleteDb = {
	prepare(sql) {
		return {
			sql,
			bind(...values) {
				this.values = values;
				return this;
			},
			async first() {
				return this.sql.includes("FROM published_notes")
					? dynamicTimelineRow
					: null;
			},
			async run() {
				return { success: true, meta: { changes: 1 } };
			},
		};
	},
	async batch(statements) {
		if (statements.length === 4) {
			return [
				{ results: [dynamicTimelineRow] },
				{ results: [] },
				{ results: [] },
				{ results: [] },
			];
		}
		timelineMutationBatches.push(statements);
		return statements.map(() => ({ success: true, meta: { changes: 1 } }));
	},
};
const adminTimelineDelete = await deleteTimelineEvent({
	request: new Request("https://digvps.pages.dev/api/admin/timeline", {
		method: "DELETE",
		headers: {
			Origin: "https://digvps.pages.dev",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			eventId: "dynamic:test-note:published:100",
		}),
	}),
	data: { user: { id: "admin-1", role: "admin" } },
	env: { DB: timelineDeleteDb },
});
assert.equal(adminTimelineDelete.status, 200);
const adminTimelineDeleteBody = await adminTimelineDelete.json();
assert.equal(adminTimelineDeleteBody.noteDeleted, true);
assert.equal(adminTimelineDeleteBody.noteTitle, "待删除笔记");
assert.equal(timelineMutationBatches.length, 1);
assert.match(timelineMutationBatches[0][0].sql, /UPDATE published_notes/u);
assert.match(timelineMutationBatches[0][1].sql, /hidden_timeline_events/u);

const regularModeration = await moderateComment({
	request: new Request("https://digvps.pages.dev/api/admin/comments", {
		method: "POST",
	}),
	data: { user: { id: "user-1", role: "user" } },
});
assert.equal(regularModeration.status, 403);

const oversizedComment = await submitComment({
	request: new Request("https://digvps.pages.dev/api/note-comments", {
		method: "POST",
		headers: {
			Origin: "https://digvps.pages.dev",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			note: "static:notes/linux/全局",
			noteTitle: "Linux",
			content: "字".repeat(501),
		}),
	}),
	data: { user: { id: "user-1", email: "reader@example.com", role: "user" } },
	env: { DB: {} },
});
assert.equal(oversizedComment.status, 400);

const rateLimitedComment = await submitComment({
	request: new Request("https://digvps.pages.dev/api/note-comments", {
		method: "POST",
		headers: {
			Origin: "https://digvps.pages.dev",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			note: "static:notes/linux/全局",
			noteTitle: "Linux",
			content: "第五条评论",
		}),
	}),
	data: { user: { id: "user-1", email: "reader@example.com", role: "user" } },
	env: {
		DB: {
			prepare() {
				return {
					bind() {
						return {
							first: async () => null,
							run: async () => ({ meta: { changes: 0 } }),
						};
					},
				};
			},
		},
	},
});
assert.equal(rateLimitedComment.status, 429);

console.log("Authentication, notes, and activity unit tests passed.");
