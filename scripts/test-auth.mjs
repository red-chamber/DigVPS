import assert from "node:assert/strict";
import { onRequest as authMiddleware } from "../functions/_middleware.js";
import {
	createSessionRecord,
	derivePasswordHash,
	randomVerificationCode,
	requestHasSameOrigin,
	SESSION_TTL_SECONDS,
	sessionCookie,
	verifyPassword,
} from "../server/auth.js";

const adminSalt = "RYzcl7QJPExAFwJ11EEF1Q";
const adminHash = "vEiRzGYsUJflWA6cWwRtg7f5Pv5QfiFnKuL9RiXsSt0";

assert.equal(await verifyPassword("history-redacted-test-password", adminHash, adminSalt), true);
assert.equal(await verifyPassword("wrong", adminHash, adminSalt), false);
assert.equal(await derivePasswordHash("history-redacted-test-password", adminSalt), adminHash);
assert.match(randomVerificationCode(), /^\d{6}$/u);

const session = await createSessionRecord("user-1", 1_000);
assert.equal(session.expiresAt, 1_000 + SESSION_TTL_SECONDS);
assert.match(sessionCookie(session.token), /Max-Age=259200/u);
assert.match(sessionCookie(session.token), /HttpOnly; Secure; SameSite=Lax/u);

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

const legacyAllowed = await authMiddleware({
	request: new Request("https://digvps.pages.dev/", {
		headers: { Authorization: `Basic ${btoa("root:history-redacted-test-password")}` },
	}),
	env: {},
	data: {},
	next: async () => new Response("OK"),
});
assert.equal(legacyAllowed.status, 200);

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

const retiredWallpaper = await runMiddleware({
	url: "https://digvps.pages.dev/background/valley.jpg",
	env: configuredEnv,
});
assert.equal(retiredWallpaper.status, 404);

console.log("Authentication unit tests passed.");
