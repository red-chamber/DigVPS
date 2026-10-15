const EXPECTED_USERNAME = "root";
const RETIRED_WALLPAPER_PATH = "/background/valley.jpg";
const EXPECTED_PASSWORD_SHA256 =
	"6f7ac1823da81d2e52d1a1549ee69c85bbf8bb56d06682849e7c09da2785ce3b";

function unauthorized() {
	return new Response("Authentication required.", {
		status: 401,
		headers: {
			"Cache-Control": "no-store",
			"Content-Type": "text/plain; charset=UTF-8",
			"WWW-Authenticate": 'Basic realm="RC Domain", charset="UTF-8"',
		},
	});
}

function parseBasicAuthorization(header) {
	if (!header?.startsWith("Basic ")) return null;

	try {
		const decoded = atob(header.slice(6).trim());
		const separator = decoded.indexOf(":");
		if (separator < 0) return null;
		return {
			username: decoded.slice(0, separator),
			password: decoded.slice(separator + 1),
		};
	} catch {
		return null;
	}
}

async function sha256(value) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function timingSafeEqual(left, right) {
	const length = Math.max(left.length, right.length);
	let mismatch = left.length ^ right.length;
	for (let index = 0; index < length; index += 1) {
		mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
	}
	return mismatch === 0;
}

export const onRequest = async ({ request, next }) => {
	const credentials = parseBasicAuthorization(
		request.headers.get("Authorization"),
	);
	const username = credentials?.username ?? "";
	const passwordHash = await sha256(credentials?.password ?? "");

	if (
		!timingSafeEqual(username, EXPECTED_USERNAME) ||
		!timingSafeEqual(passwordHash, EXPECTED_PASSWORD_SHA256)
	) {
		return unauthorized();
	}

	if (new URL(request.url).pathname === RETIRED_WALLPAPER_PATH) {
		return new Response("Not found.", {
			status: 404,
			headers: {
				"Cache-Control": "no-store",
				"Content-Type": "text/plain; charset=UTF-8",
			},
		});
	}

	return next();
};
