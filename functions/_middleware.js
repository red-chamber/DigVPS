import {
	authIsConfigured,
	getSession,
	json,
	sha256,
	timingSafeEqual,
} from "../server/auth.js";

const LEGACY_USERNAME = "root";
const LEGACY_PASSWORD_SHA256 = "b3rBgj2oHS5S0aFUnuachbv4u1bQZoKEnnwJ2ieFzjs";
const RETIRED_WALLPAPER_PATH = "/background/valley.jpg";
const CANONICAL_HOST = "cedrian.cn";
const DOMAIN_ALIASES = new Set(["www.cedrian.cn", "digvps.pages.dev"]);

const PUBLIC_PAGES = new Set(["/login", "/register"]);
const PUBLIC_AUTH_APIS = new Set([
	"/api/auth/login",
	"/api/auth/register",
	"/api/auth/verify",
]);
const PUBLIC_ASSET_PREFIXES = [
	"/_astro/",
	"/assets/",
	"/background/",
	"/favicon/",
	"/pagefind/",
];

function normalizePath(pathname) {
	if (pathname === "/") return pathname;
	return pathname.replace(/\/+$/u, "");
}

function legacyUnauthorized() {
	return new Response("Authentication required.", {
		status: 401,
		headers: {
			"Cache-Control": "no-store",
			"Content-Type": "text/plain; charset=UTF-8",
			"WWW-Authenticate": 'Basic realm="Cedrian Ian", charset="UTF-8"',
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

async function legacyBasicAuth(request, next) {
	const credentials = parseBasicAuthorization(
		request.headers.get("Authorization"),
	);
	const username = credentials?.username ?? "";
	const passwordHash = await sha256(credentials?.password ?? "");
	if (
		!timingSafeEqual(username, LEGACY_USERNAME) ||
		!timingSafeEqual(passwordHash, LEGACY_PASSWORD_SHA256)
	) {
		return legacyUnauthorized();
	}
	if (new URL(request.url).pathname === RETIRED_WALLPAPER_PATH) {
		return new Response("Not found.", { status: 404 });
	}
	return next();
}

function isPublicAsset(pathname) {
	return PUBLIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function loginRedirect(url) {
	const loginUrl = new URL("/login/", url);
	const next = `${url.pathname}${url.search}`;
	if (next !== "/") loginUrl.searchParams.set("next", next);
	return Response.redirect(loginUrl, 302);
}

export const onRequest = async (context) => {
	const { request, env, next } = context;
	const url = new URL(request.url);
	if (DOMAIN_ALIASES.has(url.hostname)) {
		url.protocol = "https:";
		url.hostname = CANONICAL_HOST;
		url.port = "";
		return Response.redirect(url, 308);
	}
	if (!authIsConfigured(env)) return legacyBasicAuth(request, next);

	const pathname = normalizePath(url.pathname);
	if (url.pathname === RETIRED_WALLPAPER_PATH) {
		return new Response("Not found.", {
			status: 404,
			headers: {
				"Cache-Control": "no-store",
				"Content-Type": "text/plain; charset=UTF-8",
			},
		});
	}
	if (isPublicAsset(url.pathname) || PUBLIC_AUTH_APIS.has(pathname)) {
		return next();
	}

	let session;
	try {
		session = await getSession(context);
	} catch (error) {
		console.error("Session middleware failed:", error.message);
		if (pathname.startsWith("/api/")) {
			return json({ error: "The session service is temporarily unavailable." }, 503);
		}
		return new Response("Authentication service unavailable.", {
			status: 503,
			headers: { "Cache-Control": "no-store" },
		});
	}

	if (PUBLIC_PAGES.has(pathname)) {
		return session ? Response.redirect(new URL("/", url), 302) : next();
	}
	if (!session) {
		return pathname.startsWith("/api/")
			? json({ error: "You are not signed in." }, 401)
			: loginRedirect(url);
	}

	context.data.user = session.user;
	if (pathname.startsWith("/posts/notes/")) {
		let slug;
		try {
			slug = decodeURIComponent(pathname.slice("/posts/".length));
		} catch {
			return new Response("Not found.", { status: 404 });
		}
		const deleted = await env.DB.prepare(
			"SELECT note_key FROM deleted_static_notes WHERE note_key = ?1",
		)
			.bind(`static:${slug}`)
			.first();
		if (deleted) {
			return new Response("Not found.", {
				status: 404,
				headers: { "Cache-Control": "private, no-store" },
			});
		}
	}
	const response = await next();
	const contentType = response.headers.get("Content-Type") || "";
	if (!contentType.includes("text/html")) return response;
	const headers = new Headers(response.headers);
	headers.set("Cache-Control", "private, no-store");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
};
