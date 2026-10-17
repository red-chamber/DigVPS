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
			subject: "Cedrian Ian 注册验证码",
			textContent: `你的 Cedrian Ian 注册验证码是：${code}\n\n验证码将在 ${minutes} 分钟后失效。若不是你本人操作，请忽略此邮件。`,
			htmlContent: `
				<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#17343d;max-width:560px;margin:auto;padding:24px">
					<h1 style="font-size:22px;margin:0 0 16px">Cedrian Ian 邮箱验证</h1>
					<p>你的注册验证码是：</p>
					<p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:20px 0">${code}</p>
					<p>验证码将在 ${minutes} 分钟后失效。若不是你本人操作，请忽略此邮件。</p>
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
