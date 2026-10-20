import { type CanvasDocument, migrateDocument } from "./model";

export interface CanvasMetadata {
	slug: string;
	title: string;
	description: string;
	category: string;
	tags: string[];
}
export interface LoadedDocument {
	document: CanvasDocument;
	revision: number;
	metadata?: CanvasMetadata;
	readOnly?: boolean;
}
export interface UploadedAsset {
	url: string;
	name: string;
	thumbnail?: string;
}
export interface CanvasAdapter {
	loadDocument: (id: string) => Promise<LoadedDocument>;
	saveDocument: (
		id: string,
		document: CanvasDocument,
		revision: number,
		metadata?: CanvasMetadata,
	) => Promise<{ revision: number }>;
	uploadAsset?: (id: string, file: File) => Promise<UploadedAsset>;
	createDocument?: (
		document: CanvasDocument,
		metadata?: CanvasMetadata,
	) => Promise<string>;
}
export class ConflictError extends Error {
	constructor() {
		super(
			"A newer revision exists. Export your changes, then reload to review the latest version.",
		);
	}
}
export function memoryAdapter(seed: CanvasDocument): CanvasAdapter {
	const docs = new Map<string, LoadedDocument>([
		[seed.id, { document: seed, revision: 1 }],
	]);
	return {
		async loadDocument(id) {
			const saved = docs.get(id);
			if (!saved) throw new Error("Whiteboard not found.");
			return structuredClone(saved);
		},
		async saveDocument(id, document, revision) {
			const current = docs.get(id);
			if (current && current.revision !== revision) throw new ConflictError();
			docs.set(id, {
				document: structuredClone(document),
				revision: revision + 1,
			});
			return { revision: revision + 1 };
		},
		async createDocument(document) {
			docs.set(document.id, { document, revision: 1 });
			return document.id;
		},
	};
}
export function localStorageAdapter(seed: CanvasDocument): CanvasAdapter {
	const key = (id: string) => `cedrian-canvas:${id}`;
	return {
		async loadDocument(id) {
			const raw = localStorage.getItem(key(id));
			if (!raw) return { document: seed, revision: 0 };
			const saved = JSON.parse(raw);
			return {
				document: migrateDocument(saved.document),
				revision: saved.revision,
			};
		},
		async saveDocument(id, document, revision) {
			const raw = localStorage.getItem(key(id));
			const current = raw ? JSON.parse(raw).revision : 0;
			if (current !== revision) throw new ConflictError();
			localStorage.setItem(
				key(id),
				JSON.stringify({ document, revision: revision + 1 }),
			);
			return { revision: revision + 1 };
		},
		async createDocument(document) {
			localStorage.setItem(
				key(document.id),
				JSON.stringify({ document, revision: 1 }),
			);
			return document.id;
		},
	};
}
export class Autosave {
	private generation = 0;
	private saved = 0;
	private timer?: ReturnType<typeof setTimeout>;
	private running?: Promise<void>;
	private stopped = false;
	status = "Saved";
	constructor(
		private id: string,
		public revision: number,
		private snapshot: () => CanvasDocument,
		private save: CanvasAdapter["saveDocument"],
		private notify: (status: string) => void,
		private delay = 1100,
		private metadata?: () => CanvasMetadata,
	) {}
	get dirty(): boolean {
		return this.generation !== this.saved;
	}
	change(): void {
		this.generation++;
		clearTimeout(this.timer);
		this.status = "Unsaved changes";
		this.notify(this.status);
		if (!this.stopped)
			this.timer = setTimeout(() => void this.flush(), this.delay);
	}
	flush(): Promise<void> {
		clearTimeout(this.timer);
		if (this.running) return this.running;
		if (!this.dirty || this.stopped) return Promise.resolve();
		this.running = this.drain().finally(() => {
			this.running = undefined;
		});
		return this.running;
	}
	private async drain(): Promise<void> {
		while (this.dirty && !this.stopped) {
			const generation = this.generation;
			this.status = "Saving…";
			this.notify(this.status);
			try {
				const result = await this.save(
					this.id,
					this.snapshot(),
					this.revision,
					this.metadata?.(),
				);
				this.revision = result.revision;
				this.saved = generation;
			} catch (error) {
				this.stopped = true;
				this.status = error instanceof Error ? error.message : "Save failed.";
				this.notify(this.status);
				return;
			}
		}
		this.status = "Saved";
		this.notify(this.status);
	}
	retry(): void {
		this.stopped = false;
		void this.flush();
	}
	destroy(): void {
		clearTimeout(this.timer);
		this.stopped = true;
	}
}
