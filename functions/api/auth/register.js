import {
	authIsConfigured,
	clientIpHash,
	hashPassword,
	json,
	normalizeEmail,
	pruneExpiredAuthRecords,
	randomToken,
	randomVerificationCode,
	readJson,
	recordActivity,
	registrationIpLimit,
	requestHasSameOrigin,
	VERIFICATION_RESEND_SECONDS,
	VERIFICATION_TTL_SECONDS,
	validateEmail,
	validatePassword,
	verificationCodeHash,
} from "../../../server/auth.js";
import { sendVerificationEmail } from "../../../server/email.js";

export async function onRequestPost(context) {
	const { request, env } = context;
	if (!authIsConfigured(env)) {
		return json({ error: "Registration has not been fully configured." }, 503);
	}
	if (!requestHasSameOrigin(request)) {
		return json({ error: "Invalid request origin." }, 403);
	}

	let body;
	try {
		body = await readJson(request);
	} catch (error) {
		return json({ error: error.message || "Invalid request format." }, 400);
	}

	const email = normalizeEmail(body.email);
	const password = body.password;
	if (!validateEmail(email)) return json({ error: "Invalid email address." }, 400);
	const passwordError = validatePassword(password);
	if (passwordError) return json({ error: passwordError }, 400);

	const now = Math.floor(Date.now() / 1000);
	const requestIpHash = await clientIpHash(env, request);

	try {
		const [existingUser, existingVerification, recentIpRequests] =
			await Promise.all([
				env.DB.prepare(
					"SELECT id, email_verified FROM users WHERE email = ?1 COLLATE NOCASE",
				)
					.bind(email)
					.first(),
				env.DB.prepare(
					`SELECT v.sent_at
					 FROM email_verifications AS v
					 JOIN users AS u ON u.id = v.user_id
					 WHERE u.email = ?1 COLLATE NOCASE`,
				)
					.bind(email)
					.first(),
				env.DB.prepare(
					`SELECT COUNT(*) AS count
					 FROM email_verifications
					 WHERE request_ip_hash = ?1 AND sent_at > ?2`,
				)
					.bind(requestIpHash, now - 60 * 60)
					.first(),
			]);

		if (existingUser?.email_verified) {
			return json({ error: "This email is already registered. Sign in instead." }, 409);
		}
		if (
			existingVerification &&
			now - existingVerification.sent_at < VERIFICATION_RESEND_SECONDS
		) {
			return json(
				{
					error: "Verification codes are being requested too frequently. Please try again later.",
					retryAfter:
						VERIFICATION_RESEND_SECONDS - (now - existingVerification.sent_at),
				},
				429,
			);
		}
		if (Number(recentIpRequests?.count || 0) >= registrationIpLimit()) {
			return json({ error: "Too many registration requests from this network. Please try again in one hour." }, 429);
		}

		const userId = existingUser?.id || randomToken(18);
		const { hash: passwordHash, salt: passwordSalt } =
			await hashPassword(password);
		const verificationCode = randomVerificationCode();
		const codeHash = await verificationCodeHash(env, userId, verificationCode);
		const expiresAt = now + VERIFICATION_TTL_SECONDS;

		if (existingUser) {
			await env.DB.batch([
				env.DB.prepare(
					`UPDATE users
					 SET password_hash = ?1, password_salt = ?2, failed_login_count = 0,
					     locked_until = NULL
					 WHERE id = ?3 AND email_verified = 0`,
				).bind(passwordHash, passwordSalt, userId),
				env.DB.prepare(
					`INSERT INTO email_verifications
					 (user_id, code_hash, expires_at, attempts, sent_at, request_ip_hash)
					 VALUES (?1, ?2, ?3, 0, ?4, ?5)
					 ON CONFLICT(user_id) DO UPDATE SET
					   code_hash = excluded.code_hash,
					   expires_at = excluded.expires_at,
					   attempts = 0,
					   sent_at = excluded.sent_at,
					   request_ip_hash = excluded.request_ip_hash`,
				).bind(userId, codeHash, expiresAt, now, requestIpHash),
			]);
		} else {
			await env.DB.batch([
				env.DB.prepare(
					`INSERT INTO users
					 (id, email, password_hash, password_salt, created_at)
					 VALUES (?1, ?2, ?3, ?4, ?5)`,
				).bind(userId, email, passwordHash, passwordSalt, now),
				env.DB.prepare(
					`INSERT INTO email_verifications
					 (user_id, code_hash, expires_at, attempts, sent_at, request_ip_hash)
					 VALUES (?1, ?2, ?3, 0, ?4, ?5)`,
				).bind(userId, codeHash, expiresAt, now, requestIpHash),
			]);
		}

		try {
			await sendVerificationEmail(env, email, verificationCode);
		} catch (error) {
			console.error("Failed to send verification email:", error.message);
			const cleanup = [
				env.DB.prepare(
					"DELETE FROM email_verifications WHERE user_id = ?1",
				).bind(userId),
			];
			if (!existingUser) {
				cleanup.push(
					env.DB.prepare(
						"DELETE FROM users WHERE id = ?1 AND email_verified = 0",
					).bind(userId),
				);
			}
			await env.DB.batch(cleanup);
			return json({ error: "Failed to send the verification email. Please try again later." }, 502);
		}

		context.waitUntil?.(pruneExpiredAuthRecords(env.DB, now));
		await recordActivity(context, {
			userId,
			eventType: "registration_requested",
			path: "/api/auth/register",
		});
		return json({
			ok: true,
			email,
			expiresIn: VERIFICATION_TTL_SECONDS,
		});
	} catch (error) {
		console.error("Registration failed:", error.message);
		return json({ error: "The registration service is temporarily unavailable. Please try again later." }, 500);
	}
}
