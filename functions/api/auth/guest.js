import {
	GUEST_COOKIE_NAME,
	json,
	requestHasSameOrigin,
} from "../../../server/auth.js";

export function onRequestPost(context) {
	if (!requestHasSameOrigin(context.request)) {
		return json({ error: "Invalid request origin." }, 403);
	}
	return json({ ok: true }, 200, {
		"Set-Cookie": `${GUEST_COOKIE_NAME}=1; Path=/; HttpOnly; Secure; SameSite=Lax`,
	});
}
