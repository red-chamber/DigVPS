import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "Cedrian Ian",
	subtitle: "Personal Blog",
	lang: "en", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
	themeColor: {
		hue: 195, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
		fixed: true, // Hide the theme color picker for visitors
	},
	banner: {
		enable: false,
		src: "assets/images/demo-banner.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
		position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
		credit: {
			enable: false, // Display the credit text of the banner image
			text: "", // Credit text to be displayed
			url: "", // (Optional) URL link to the original artwork or artist's page
		},
	},
	toc: {
		enable: true, // Display the table of contents on the right side of the post
		depth: 6, // Maximum heading depth to show in the table, from 1 to 6
	},
	favicon: [
		{ src: "/favicon/favicon.svg", sizes: "any" },
		{ src: "/favicon/favicon.ico" },
		{ src: "/favicon/icon-32.png", sizes: "32x32" },
		{ src: "/favicon/icon-16.png", sizes: "16x16" },
	],
};

export const navBarConfig: NavBarConfig = {
	links: [
		{
			name: "Notes",
			url: "/notes/",
			external: false,
		},
		LinkPreset.Archive,
		{
			name: "Account",
			url: "/account/",
			external: false,
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/doro.jpg", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "Cedrian",
	bio: "A HUST student majoring in Computer Science.",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/red-chamber/",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
	// Please select a dark theme, as this blog theme currently only supports dark background color
	theme: "github-dark",
};
