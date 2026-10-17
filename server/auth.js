const textEncoder = new TextEncoder();

export const SESSION_COOKIE_NAME = "digvps_session";
export const SESSION_TTL_SECONDS = 3 * 24 * 60 * 60;
export const VERIFICATION_TTL_SECONDS = 10 * 60;
export const VERIFICATION_RESEND_SECONDS = 60;
// Cloudflare workerd enforces a hard ceiling of 100,000 PBKDF2 iterations.
export const PASSWORD_ITERATIONS = 100_000;
export const DEFAULT_EMAIL_FROM = "autoverification@163.com";

const MAX_JSON_BYTES = 16 * 1024;
const LOGIN_LOCK_SECONDS = 15 * 60;
const MAX_LOGIN_FAILURES = 5;
const MAX_VERIFICATION_ATTEMPTS = 5;
const MAX_REGISTRATIONS_PER_IP_HOUR = 5;
const DUMMY_PASSWORD_SALT = "AAAAAAAAAAAAAAAAAAAAAA";

function bytesToBase64Url(bytes) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
	const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function json(data, status = 200, extraHeaders = {}) {
	const headers = new Headers(extraHeaders);
	headers.set("Content-Type", "application/json; charset=UTF-8");
	headers.set("Cache-Control", "no-store");
	return new Response(JSON.stringify(data), { status, headers });
}

export function authIsConfigured(env) {
	return Boolean(env?.DB && env.AUTH_SECRET && env.BREVO_API_KEY);
}

export function requireAuthConfiguration(env) {
	if (!authIsConfigured(env)) {
		throw new Error("Authentication service is not configured.");
	}
}

export function requestHasSameOrigin(request) {
	const origin = request.headers.get("Origin");
	return Boolean(origin && origin === new URL(request.url).origin);
}

export async function readJson(request, maxBytes = MAX_JSON_BYTES) {
	const contentType = request.headers.get("Content-Type") || "";
	if (!contentType.toLowerCase().includes("application/json")) {
		throw new TypeError("The request must use JSON format.");
	}
	const contentLength = Number(request.headers.get("Content-Length") || 0);
	if (contentLength > maxBytes) {
		throw new RangeError("The request body is too large.");
	}
	const raw = await request.text();
	if (textEncoder.encode(raw).byteLength > maxBytes) {
		throw new RangeError("The request body is too large.");
	}
	return JSON.parse(raw);
}

export function normalizeEmail(value) {
	return String(value || "")
		.trim()
		.toLowerCase();
}

export function validateEmail(email) {
	return (
		email.length >= 3 &&
		email.length <= 254 &&
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
	);
}

export function validatePassword(password) {
	if (typeof password !== "string" || password.length < 8) {
		return "The password must contain at least 8 characters.";
	}
	if (password.length > 128) return "The password cannot exceed 128 characters.";
	return null;
}

export function timingSafeEqual(left, right) {
	const leftValue = String(left);
	const rightValue = String(right);
	const length = Math.max(leftValue.length, rightValue.length);
	let mismatch = leftValue.length ^ rightValue.length;
	for (let index = 0; index < length; index += 1) {
		mismatch |=
			(leftValue.charCodeAt(index) || 0) ^ (rightValue.charCodeAt(index) || 0);
	}
	return mismatch === 0;
}

export function randomToken(byteLength = 32) {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return bytesToBase64Url(bytes);
}

export function randomVerificationCode() {
	const upperBound = 0x1_0000_0000;
	const largestMultiple = upperBound - (upperBound % 1_000_000);
	const values = new Uint32Array(1);
	do {
		crypto.getRandomValues(values);
	} while (values[0] >= largestMultiple);
	return String(values[0] % 1_000_000).padStart(6, "0");
}

async function digest(algorithm, value) {
	const result = await crypto.subtle.digest(
		algorithm,
		textEncoder.encode(value),
	);
	return bytesToBase64Url(new Uint8Array(result));
}

export function sha256(value) {
	return digest("SHA-256", value);
}

export async function hmacSha256(secret, value) {
	const key = await crypto.subtle.importKey(
		"raw",
		textEncoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		textEncoder.encode(value),
	);
	return bytesToBase64Url(new Uint8Array(signature));
}

export async function derivePasswordHash(password, salt) {
	const key = await crypto.subtle.importKey(
		"raw",
		textEncoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			hash: "SHA-256",
			iterations: PASSWORD_ITERATIONS,
			salt: base64UrlToBytes(salt),
		},
		key,
		256,
	);
	return bytesToBase64Url(new Uint8Array(bits));
}

export async function hashPassword(password) {
	const salt = randomToken(16);
	return { salt, hash: await derivePasswordHash(password, salt) };
}

export async function verifyPassword(password, expectedHash, salt) {
	const suppliedHash = await derivePasswordHash(password, salt);
	return timingSafeEqual(suppliedHash, expectedHash);
}

export async function performDummyPasswordCheck(password) {
	await derivePasswordHash(password, DUMMY_PASSWORD_SALT);
}

export function parseCookies(request) {
	const result = new Map();
	const header = request.headers.get("Cookie") || "";
	for (const entry of header.split(";")) {
		const separator = entry.indexOf("=");
		if (separator < 0) continue;
		const name = entry.slice(0, separator).trim();
		const value = entry.slice(separator + 1).trim();
		if (name) result.set(name, value);
	}
	return result;
}

export function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
	return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
	return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function createSessionRecord(
	userId,
	now = Math.floor(Date.now() / 1000),
) {
	const token = randomToken(32);
	return {
		token,
		tokenHash: await sha256(token),
		userId,
		createdAt: now,
		expiresAt: now + SESSION_TTL_SECONDS,
	};
}

export function replaceUserSessionStatements(db, session) {
	return [
		db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(session.userId),
		db
			.prepare(
				`INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
				 VALUES (?1, ?2, ?3, ?4)`,
			)
			.bind(
				session.tokenHash,
				session.userId,
				session.createdAt,
				session.expiresAt,
			),
	];
}

export async function getSession(context) {
	const token = parseCookies(context.request).get(SESSION_COOKIE_NAME);
	if (!token || !context.env?.DB) return null;
	const tokenHash = await sha256(token);
	const now = Math.floor(Date.now() / 1000);
	const row = await context.env.DB.prepare(
		`SELECT s.token_hash, s.expires_at, u.id, u.email, u.username, u.role
		 FROM sessions AS s
		 JOIN users AS u ON u.id = s.user_id
		 WHERE s.token_hash = ?1 AND s.expires_at > ?2 AND u.email_verified = 1`,
	)
		.bind(tokenHash, now)
		.first();
	if (!row) return null;
	return {
		tokenHash,
		expiresAt: row.expires_at,
		user: {
			id: row.id,
			email: row.email,
			username: row.username,
			role: row.role,
		},
	};
}

export async function verificationCodeHash(env, userId, code) {
	return hmacSha256(env.AUTH_SECRET, `verification:${userId}:${code}`);
}

export async function clientIpHash(env, request) {
	const address = request.headers.get("CF-Connecting-IP") || "unknown";
	return hmacSha256(env.AUTH_SECRET, `ip:${address}`);
}

function cleanActivityPath(value) {
	if (!value) return null;
	try {
		const url = new URL(value, "https://activity.invalid");
		return `${url.pathname}${url.search}`.slice(0, 500);
	} catch {
		return String(value).slice(0, 500);
	}
}

export async function recordActivity(
	context,
	{ userId = null, eventType, path = null } = {},
) {
	if (!context?.env?.DB || !eventType) return;
	try {
		const ipHash = context.env.AUTH_SECRET
			? await clientIpHash(context.env, context.request)
			: null;
		const userAgent = (
			context.request.headers.get("User-Agent") || "unknown"
		).slice(0, 300);
		const now = Math.floor(Date.now() / 1000);
		await context.env.DB.prepare(
			`INSERT INTO user_activities
			 (user_id, event_type, path, ip_hash, user_agent, created_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
		)
			.bind(
				userId,
				String(eventType).slice(0, 64),
				cleanActivityPath(path),
				ipHash,
				userAgent,
				now,
			)
			.run();
	} catch (error) {
		// Activity logging must never prevent authentication or page delivery.
		console.warn("Activity logging failed:", error.message);
	}
}

export function verificationAttemptLimit() {
	return MAX_VERIFICATION_ATTEMPTS;
}

export function loginFailureLimit() {
	return MAX_LOGIN_FAILURES;
}

export function loginLockSeconds() {
	return LOGIN_LOCK_SECONDS;
}

export function registrationIpLimit() {
	return MAX_REGISTRATIONS_PER_IP_HOUR;
}

export async function pruneExpiredAuthRecords(
	db,
	now = Math.floor(Date.now() / 1000),
) {
	await db.batch([
		db.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(now),
		db
			.prepare("DELETE FROM email_verifications WHERE expires_at <= ?1")
			.bind(now - 24 * 60 * 60),
		db
			.prepare(
				`DELETE FROM users
				 WHERE email_verified = 0
				   AND created_at <= ?1
				   AND NOT EXISTS (
				     SELECT 1 FROM email_verifications WHERE user_id = users.id
				   )`,
			)
			.bind(now - 24 * 60 * 60),
	]);
}
