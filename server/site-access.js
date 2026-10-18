export async function loadSiteAccess(db) {
	const row = await db
		.prepare("SELECT paused, updated_at FROM site_access WHERE id = 1")
		.first();
	return {
		paused: row?.paused === 1,
		updatedAt: row?.updated_at ?? null,
	};
}

export async function updateSiteAccess(db, paused, userId, updatedAt) {
	await db
		.prepare(
			`UPDATE site_access
			 SET paused = ?1, updated_by = ?2, updated_at = ?3
			 WHERE id = 1`,
		)
		.bind(paused ? 1 : 0, userId, updatedAt)
		.run();
	return { paused, updatedAt };
}
