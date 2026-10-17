import { DEFAULT_EMAIL_FROM, VERIFICATION_TTL_SECONDS } from "./auth.js";

export async function sendVerificationEmail(env, recipient, code) {
	if (!env.BREVO_API_KEY) throw new Error("BREVO_API_KEY is not configured.");

	const senderEmail = env.AUTH_EMAIL_FROM || DEFAULT_EMAIL_FROM;
	const minutes = Math.floor(VERIFICATION_TTL_SECONDS / 60);
	const response = await fetch("https://api.brevo.com/v3/smtp/email", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"api-key": env.BREVO_API_KEY,
		},
		body: JSON.stringify({
			sender: { email: senderEmail, name: "Cedrian Ian" },
			to: [{ email: recipient }],
			subject: "Cedrian Ian verification code",
			textContent: `Your Cedrian Ian verification code is: ${code}\n\nThis code expires in ${minutes} minutes. If you did not request it, you can ignore this email.`,
			htmlContent: `
				<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#17343d;max-width:560px;margin:auto;padding:24px">
					<h1 style="font-size:22px;margin:0 0 16px">Verify Your Cedrian Ian Email</h1>
					<p>Your registration verification code is:</p>
					<p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:20px 0">${code}</p>
					<p>This code expires in ${minutes} minutes. If you did not request it, you can ignore this email.</p>
				</div>`,
		}),
	});

	if (!response.ok) {
		const details = (await response.text()).slice(0, 500);
		throw new Error(
			`Brevo rejected the email (${response.status}): ${details}`,
		);
	}
}
