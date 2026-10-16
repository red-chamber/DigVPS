import assert from "node:assert/strict";
import { onRequest as authMiddleware } from "../functions/_middleware.js";
import { onRequestGet as adminActivity } from "../functions/api/admin/activity.js";
import { onRequestPost as moderateComment } from "../functions/api/admin/comments.js";
import { onRequestPost as publishNote } from "../functions/api/admin/notes.js";
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
	request: new Request("https://digvps.pages.dev/"),
	env: {},
	data: {},
	next: async () => new Response("OK"),
});
assert.equal(legacyDenied.status, 401);

const configuredEnv = {
	AUTH_SECRET: "test-secret-that-is-long-enough",
	BREVO_API_KEY: "test-key",
};

const publicLogin = await runMiddleware({
	url: "https://digvps.pages.dev/login/",
	env: configuredEnv,
});
assert.equal(publicLogin.status, 200);

const protectedPage = await runMiddleware({
	url: "https://digvps.pages.dev/notes/?page=1",
	env: configuredEnv,
});
assert.equal(protectedPage.status, 302);
assert.equal(
	new URL(protectedPage.headers.get("Location")).searchParams.get("next"),
	"/notes/?page=1",
);

const protectedApi = await runMiddleware({
	url: "https://digvps.pages.dev/api/auth/me",
	env: configuredEnv,
});
assert.equal(protectedApi.status, 401);

const validSession = await runMiddleware({
	url: "https://digvps.pages.dev/",
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
	url: "https://digvps.pages.dev/notes/",
	headers: { Cookie: "digvps_session=test-token" },
	env: { ...configuredEnv, DB: noPageViewDb },
});
assert.equal(
	authenticatedDbCalls,
	1,
	"HTML GET must not create page_view activity",
);

const retiredWallpaper = await runMiddleware({
	url: "https://digvps.pages.dev/background/valley.jpg",
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
						return { run: async () => ({ meta: { changes: 0 } }) };
					},
				};
			},
		},
	},
});
assert.equal(rateLimitedComment.status, 429);

console.log("Authentication, notes, and activity unit tests passed.");
