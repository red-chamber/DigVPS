import {
	authIsConfigured,
	getSession,
	json,
	sha256,
	timingSafeEqual,
} from "../server/auth.js";
import { loadSiteAccess } from "../server/site-access.js";

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
const SITE_ACCESS_PATH = "/api/site-access";
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

function siteAccessDenied(pathname) {
	const headers = {
		"Cache-Control": "no-store",
		"Content-Type": pathname.startsWith("/api/")
			? "application/json; charset=UTF-8"
			: "text/plain; charset=UTF-8",
	};
	const body = pathname.startsWith("/api/")
		? JSON.stringify({ error: "Site access is temporarily paused." })
		: "403 — Site access is temporarily paused.";
	return new Response(body, { status: 403, headers });
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
	if (isPublicAsset(url.pathname)) {
		return next();
	}

	let session;
	let siteAccess;
	try {
		[session, siteAccess] = await Promise.all([
			getSession(context),
			loadSiteAccess(env.DB),
		]);
	} catch (error) {
		console.error("Access middleware failed:", error.message);
		if (pathname.startsWith("/api/")) {
			return json(
				{ error: "The access service is temporarily unavailable." },
				503,
			);
		}
		return new Response("Access service unavailable.", {
			status: 503,
			headers: { "Cache-Control": "no-store" },
		});
	}

	if (pathname === SITE_ACCESS_PATH && request.method === "GET") {
		return siteAccess.paused && session?.user?.role !== "admin"
			? siteAccessDenied(pathname)
			: new Response(null, {
					status: 204,
					headers: { "Cache-Control": "no-store" },
				});
	}

	const maintenanceLogin =
		pathname === "/login" || pathname === "/api/auth/login";
	if (
		siteAccess.paused &&
		session?.user?.role !== "admin" &&
		!maintenanceLogin
	) {
		return siteAccessDenied(pathname);
	}

	if (PUBLIC_PAGES.has(pathname)) {
		return session && (!siteAccess.paused || session.user.role === "admin")
			? Response.redirect(new URL("/", url), 302)
			: next();
	}
	if (PUBLIC_AUTH_APIS.has(pathname)) return next();
	if (!session) {
		return pathname.startsWith("/api/")
			? json({ error: "You are not signed in." }, 401)
			: loginRedirect(url);
	}

	context.data.user = session.user;
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
