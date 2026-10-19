import assert from "node:assert/strict";
import { onRequest as authMiddleware } from "../functions/_middleware.js";
import { onRequestGet as adminActivity } from "../functions/api/admin/activity.js";
import { onRequestPost as moderateComment } from "../functions/api/admin/comments.js";
import { onRequestPost as reviewNoteSubmission } from "../functions/api/admin/note-submissions.js";
import {
	onRequestPost as publishNote,
	onRequestPut as updateNote,
} from "../functions/api/admin/notes.js";
import {
	onRequestGet as getSiteAccess,
	onRequestPost as setSiteAccess,
} from "../functions/api/admin/site-access.js";
import {
	onRequestDelete as deleteTimelineEvent,
	onRequestPost as publishTimelineEvent,
} from "../functions/api/admin/timeline.js";
import { onRequestPost as enterGuestMode } from "../functions/api/auth/guest.js";
import { onRequestPost as submitComment } from "../functions/api/note-comments.js";
import { onRequestGet as readInteractions } from "../functions/api/note-interactions.js";
import { onRequestPost as submitNote } from "../functions/api/note-submissions.js";
import { onRequestGet as getPublishedNote } from "../functions/api/published-note.js";
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
	prepareNoteDeletion,
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
assert.equal(await resolvePublishedNote({}, "legacy:test-note"), null);
assert.match(renderMarkdown("Inline $x^2$"), /class="katex"/u);
assert.match(
	renderMarkdown("$$\na^2 + b^2 = c^2\n$$"),
	/class="katex-display"/u,
);
assert.match(
	renderMarkdown("```python\nfor item in items:\n    print(item)\n```"),
	/class="hljs-keyword"/u,
);
assert.match(
	renderMarkdown("```c\nint main(void) { return 0; }\n```"),
	/class="hljs-type"/u,
);
assert.match(
	renderMarkdown("```cpp\nclass Example { public: int value; };\n```"),
	/class="hljs-keyword"/u,
);
assert.doesNotMatch(
	renderMarkdown("```javascript\nconst answer = 42;\n```"),
	/class="hljs-/u,
);
const publishedNoteResponse = await getPublishedNote({
	request: new Request(
		"https://digvps.pages.dev/api/published-note?slug=test-note",
	),
	env: {
		DB: {
			prepare() {
				return {
					bind() {
						return this;
					},
					async first() {
						return {
							slug: "test-note",
							title: "Test Note",
							description: "Formula test",
							category: "Math",
							tags_json: '["Math"]',
							markdown: "Inline $x^2$\n\n$$\ny = x + 1\n$$",
							published_at: 100,
							updated_at: 100,
						};
					},
				};
			},
		},
	},
});
assert.equal(publishedNoteResponse.status, 200);
const publishedNoteBody = await publishedNoteResponse.json();
assert.match(publishedNoteBody.note.rendered_html, /class="katex"/u);
assert.match(publishedNoteBody.note.rendered_html, /class="katex-display"/u);
const resolvedNote = await resolvePublishedNote(
	{
		prepare(sql) {
			return {
				sql,
				bind(...values) {
					this.values = values;
					return this;
				},
				async first() {
					return { slug: "test-note", title: "Test Note" };
				},
			};
		},
	},
	"dynamic:test-note",
);
assert.equal(resolvedNote?.slug, "test-note");
const noteDeletion = prepareNoteDeletion(
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
	resolvedNote,
);
assert.match(noteDeletion.statement.sql, /UPDATE published_notes/u);
assert.equal(noteDeletion.statement.values[0], "test-note");

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

function fakeDb(sessionRow = null, paused = false) {
	return {
		prepare(sql) {
			return {
				bind() {
					return {
						first: async () =>
							sql.includes("FROM site_access")
								? { paused: paused ? 1 : 0, updated_at: 100 }
								: sessionRow,
						run: async () => ({ success: true }),
					};
				},
				first: async () =>
					sql.includes("FROM site_access")
						? { paused: paused ? 1 : 0, updated_at: 100 }
						: sessionRow,
			};
		},
	};
}

async function runMiddleware({
	url,
	method = "GET",
	headers = {},
	env = {},
	row = null,
	paused = false,
}) {
	return authMiddleware({
		request: new Request(url, { headers, method }),
		env: { ...env, DB: env.DB || fakeDb(row, paused) },
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

const activeSiteStatus = await runMiddleware({
	url: "https://cedrian.cn/api/site-access",
	env: configuredEnv,
});
assert.equal(activeSiteStatus.status, 204);

const pausedPublicLogin = await runMiddleware({
	url: "https://cedrian.cn/login/",
	env: configuredEnv,
	paused: true,
});
assert.equal(pausedPublicLogin.status, 200);

const pausedRegistration = await runMiddleware({
	url: "https://cedrian.cn/register/",
	env: configuredEnv,
	paused: true,
});
assert.equal(pausedRegistration.status, 403);

const pausedAnonymousPage = await runMiddleware({
	url: "https://cedrian.cn/notes/",
	env: configuredEnv,
	paused: true,
});
assert.equal(pausedAnonymousPage.status, 403);

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

const guestEntry = enterGuestMode({
	request: new Request("https://cedrian.cn/api/auth/guest", {
		method: "POST",
		headers: { Origin: "https://cedrian.cn" },
	}),
});
assert.equal(guestEntry.status, 200);
assert.match(
	guestEntry.headers.get("Set-Cookie"),
	/digvps_guest=1; Path=\/; HttpOnly; Secure; SameSite=Lax/u,
);
assert.equal(
	enterGuestMode({
		request: new Request("https://cedrian.cn/api/auth/guest", {
			method: "POST",
			headers: { Origin: "https://other.example" },
		}),
	}).status,
	403,
);

const guestHeaders = { Cookie: "digvps_guest=1" };
for (const path of [
	"/",
	"/about/",
	"/archive/",
	"/notes/?tag=Linux",
	"/notes/read/?slug=test-note",
	"/api/published-notes",
	"/api/published-note?slug=test-note",
	"/api/timeline",
	"/api/note-interactions?note=dynamic:test-note",
]) {
	const response = await runMiddleware({
		url: `https://cedrian.cn${path}`,
		headers: guestHeaders,
		env: configuredEnv,
	});
	assert.equal(response.status, 200, `Guest can read ${path}`);
	assert.equal(response.headers.get("Cache-Control"), "private, no-store");
	const pausedResponse = await runMiddleware({
		url: `https://cedrian.cn${path}`,
		headers: guestHeaders,
		env: configuredEnv,
		paused: true,
	});
	assert.equal(pausedResponse.status, 403, `Pause blocks guest ${path}`);
}
for (const path of [
	"/api/auth/me",
	"/api/note-submissions",
	"/api/admin/notes",
	"/api/admin/note-submissions",
	"/api/admin/activity",
]) {
	assert.equal(
		(
			await runMiddleware({
				url: `https://cedrian.cn${path}`,
				headers: guestHeaders,
				env: configuredEnv,
			})
		).status,
		401,
	);
}
for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
	for (const path of [
		"/api/note-like",
		"/api/note-comments",
		"/api/note-submissions",
		"/api/admin/notes",
		"/api/published-notes",
		"/api/note-interactions",
	]) {
		assert.equal(
			(
				await runMiddleware({
					url: `https://cedrian.cn${path}`,
					method,
					headers: guestHeaders,
					env: configuredEnv,
				})
			).status,
			401,
			`Guest denied ${method} ${path}`,
		);
	}
}
assert.equal(
	(
		await runMiddleware({
			url: "https://cedrian.cn/account/",
			headers: guestHeaders,
			env: configuredEnv,
		})
	).status,
	302,
);
assert.equal(
	(
		await runMiddleware({
			url: "https://cedrian.cn/api/auth/guest",
			method: "POST",
			env: configuredEnv,
			paused: true,
		})
	).status,
	403,
);
assert.equal(
	(
		await runMiddleware({
			url: "https://cedrian.cn/login/",
			headers: guestHeaders,
			env: configuredEnv,
		})
	).status,
	200,
);

// Guest interaction reads have no user identity and expose only approved comments.
const guestInteractionDb = {
	prepare(sql) {
		return {
			sql,
			bind(...values) {
				this.values = values;
				return this;
			},
			async first() {
				return { slug: "test-note", title: "Test Note" };
			},
		};
	},
	async batch(statements) {
		assert.equal(statements[1].values[1], null);
		assert.match(statements[2].sql, /status = 'approved'/u);
		return [
			{ results: [{ count: 2 }] },
			{ results: [] },
			{ results: [{ id: "approved-comment", content: "Published comment" }] },
		];
	},
};
const guestInteractions = await readInteractions({
	request: new Request(
		"https://cedrian.cn/api/note-interactions?note=dynamic:test-note",
	),
	data: { user: null },
	env: { DB: guestInteractionDb },
});
assert.equal(guestInteractions.status, 200);
const guestInteractionBody = await guestInteractions.json();
assert.equal(guestInteractionBody.canInteract, false);
assert.equal(guestInteractionBody.liked, false);
assert.equal(guestInteractionBody.likeCount, 2);
assert.equal(guestInteractionBody.comments.length, 1);

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

const pausedUser = await runMiddleware({
	url: "https://cedrian.cn/",
	headers: { Cookie: "digvps_session=test-token" },
	env: configuredEnv,
	paused: true,
	row: {
		token_hash: "hash",
		expires_at: 2_000_000_000,
		id: "user-1",
		email: "reader@example.com",
		username: null,
		role: "user",
	},
});
assert.equal(pausedUser.status, 403);

const pausedAdmin = await runMiddleware({
	url: "https://cedrian.cn/",
	headers: { Cookie: "digvps_session=test-token" },
	env: configuredEnv,
	paused: true,
	row: {
		token_hash: "hash",
		expires_at: 2_000_000_000,
		id: "admin-1",
		email: "admin@example.com",
		username: "root",
		role: "admin",
	},
});
assert.equal(pausedAdmin.status, 200);

let authenticatedDbCalls = 0;
const noPageViewDb = {
	prepare(sql) {
		authenticatedDbCalls += 1;
		return {
			bind() {
				return {
					first: async () =>
						sql.includes("FROM site_access")
							? { paused: 0, updated_at: 100 }
							: {
									token_hash: "hash",
									expires_at: 2_000_000_000,
									id: "user-1",
									email: "reader@example.com",
									username: null,
									role: "user",
								},
				};
			},
			first: async () => ({ paused: 0, updated_at: 100 }),
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
	2,
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

const regularSiteAccess = await getSiteAccess({
	data: { user: { id: "user-1", role: "user" } },
});
assert.equal(regularSiteAccess.status, 403);

const siteAccessSql = [];
const siteAccessBindings = [];
const adminSiteAccess = await setSiteAccess({
	request: new Request("https://digvps.pages.dev/api/admin/site-access", {
		method: "POST",
		headers: {
			Origin: "https://digvps.pages.dev",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ paused: true }),
	}),
	data: { user: { id: "admin-1", role: "admin" } },
	env: {
		DB: {
			prepare(sql) {
				siteAccessSql.push(sql);
				return {
					bind(...values) {
						siteAccessBindings.push(values);
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
assert.equal(adminSiteAccess.status, 200);
assert.equal((await adminSiteAccess.json()).state.paused, true);
assert.match(siteAccessSql[0], /UPDATE site_access/u);
assert.deepEqual(siteAccessBindings[0].slice(0, 2), [1, "admin-1"]);

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

const anonymousSubmission = await submitNote({
	request: new Request("https://digvps.pages.dev/api/note-submissions", {
		method: "POST",
	}),
	data: {},
});
assert.equal(anonymousSubmission.status, 401);

const submissionSql = [];
const submissionBindings = [];
const userSubmission = await submitNote({
	request: new Request("https://digvps.pages.dev/api/note-submissions", {
		method: "POST",
		headers: {
			Origin: "https://digvps.pages.dev",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			title: "Reader Note",
			description: "A submitted draft",
			markdown: "# Draft",
		}),
	}),
	data: { user: { id: "user-1", role: "user" } },
	env: {
		DB: {
			prepare(sql) {
				submissionSql.push(sql);
				return {
					bind(...values) {
						submissionBindings.push(values);
						return this;
					},
					async first() {
						return { total: 0 };
					},
					async run() {
						return { success: true, meta: { changes: 1 } };
					},
				};
			},
		},
	},
});
assert.equal(userSubmission.status, 201);
assert.ok(
	submissionSql.some((sql) => /INSERT INTO note_submissions/u.test(sql)),
);
assert.ok(
	submissionSql.some((sql) => /INSERT INTO user_activities/u.test(sql)),
);
assert.equal(
	submissionBindings.find((values) => values.includes("Reader Note"))?.[1],
	"user-1",
);

const regularSubmissionReview = await reviewNoteSubmission({
	request: new Request("https://digvps.pages.dev/api/admin/note-submissions", {
		method: "POST",
	}),
	data: { user: { id: "user-1", role: "user" } },
});
assert.equal(regularSubmissionReview.status, 403);

const reviewSql = [];
const reviewBatches = [];
const approvedSubmission = await reviewNoteSubmission({
	request: new Request("https://digvps.pages.dev/api/admin/note-submissions", {
		method: "POST",
		headers: {
			Origin: "https://digvps.pages.dev",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			id: "submission-1",
			action: "approve",
			title: "Reviewed Note",
			slug: "reviewed-note",
			description: "Reviewed description",
			category: "Linux",
			tags: ["Linux"],
			markdown: "# Reviewed",
		}),
	}),
	data: { user: { id: "admin-1", role: "admin" } },
	env: {
		DB: {
			prepare(sql) {
				reviewSql.push(sql);
				return {
					sql,
					bind(...values) {
						this.values = values;
						return this;
					},
					async run() {
						return { success: true, meta: { changes: 1 } };
					},
				};
			},
			async batch(statements) {
				reviewBatches.push(statements);
				return statements.map(() => ({
					success: true,
					meta: { changes: 1 },
				}));
			},
		},
	},
});
assert.equal(approvedSubmission.status, 200);
assert.equal((await approvedSubmission.json()).status, "approved");
assert.equal(reviewBatches[0].length, 2);
assert.match(reviewBatches[0][0].sql, /UPDATE note_submissions/u);
assert.match(reviewBatches[0][1].sql, /INSERT INTO published_notes/u);
assert.ok(reviewSql.some((sql) => /INSERT INTO user_activities/u.test(sql)));

const regularUpdate = await updateNote({
	request: new Request("https://digvps.pages.dev/api/admin/notes", {
		method: "PUT",
	}),
	data: { user: { id: "user-1", role: "user" } },
});
assert.equal(regularUpdate.status, 403);

const noteUpdateBatches = [];
const noteUpdateSql = [];
const dynamicEditableNote = {
	id: "note-1",
	slug: "test-note",
	title: "旧标题",
	description: "旧介绍",
	markdown: "旧正文",
	category: "Old",
	tags_json: '["old"]',
	published_at: 100,
	updated_at: 100,
};
const noteUpdateDb = {
	prepare(sql) {
		noteUpdateSql.push(sql);
		return {
			sql,
			bind(...values) {
				this.values = values;
				return this;
			},
			async first() {
				return this.sql.includes("FROM published_notes")
					? dynamicEditableNote
					: null;
			},
			async run() {
				return { success: true, meta: { changes: 1 } };
			},
		};
	},
	async batch(statements) {
		noteUpdateBatches.push(statements);
		return statements.map(() => ({ success: true, meta: { changes: 1 } }));
	},
};

async function performNoteUpdate() {
	return updateNote({
		request: new Request("https://digvps.pages.dev/api/admin/notes", {
			method: "PUT",
			headers: {
				Origin: "https://digvps.pages.dev",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				noteKey: "dynamic:test-note",
				title: "新标题",
				slug: "renamed-note",
				description: "新介绍",
				category: "Linux",
				tags: ["Linux", "CLI"],
				markdown: "# 新正文",
			}),
		}),
		data: { user: { id: "admin-1", role: "admin" } },
		env: { DB: noteUpdateDb },
	});
}

const firstNoteUpdate = await performNoteUpdate();
const secondNoteUpdate = await performNoteUpdate();
assert.equal(firstNoteUpdate.status, 200);
assert.equal(secondNoteUpdate.status, 200);
const firstNoteUpdateBody = await firstNoteUpdate.json();
const secondNoteUpdateBody = await secondNoteUpdate.json();
assert.equal(firstNoteUpdateBody.noteKey, "dynamic:renamed-note");
assert.notEqual(firstNoteUpdateBody.eventId, secondNoteUpdateBody.eventId);
assert.equal(noteUpdateBatches.length, 2);
assert.equal(noteUpdateBatches[0].length, 4);
assert.match(noteUpdateBatches[0][0].sql, /UPDATE published_notes/u);
assert.match(noteUpdateBatches[0][1].sql, /UPDATE note_comments/u);
assert.match(noteUpdateBatches[0][2].sql, /UPDATE note_likes/u);
assert.match(noteUpdateBatches[0][3].sql, /INSERT INTO note_update_history/u);
assert.ok(
	noteUpdateSql.some((sql) => /INSERT INTO user_activities/u.test(sql)),
);

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
			note: "dynamic:test-note",
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
			note: "dynamic:test-note",
			noteTitle: "Linux",
			content: "第五条评论",
		}),
	}),
	data: { user: { id: "user-1", email: "reader@example.com", role: "user" } },
	env: {
		DB: {
			prepare(sql) {
				return {
					bind() {
						return {
							first: async () =>
								sql.includes("FROM published_notes")
									? { slug: "test-note", title: "Test Note" }
									: null,
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
