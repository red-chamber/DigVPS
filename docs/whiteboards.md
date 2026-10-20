# Whiteboards

The whiteboard editor is an independent Astro/Svelte implementation. It does not use or copy Obsidian Advanced Canvas source code.

## Embedding

```svelte
<AdvancedCanvasEditor
  documentId={documentId}
  readOnly={false}
  adapter={adapter}
/>
```

`CanvasAdapter` keeps the editor independent from storage. The repository includes D1/API, in-memory and localStorage adapters. An adapter loads and saves a versioned `CanvasDocument`, applies optimistic revision checks, and optionally uploads assets.

## Data and compatibility

- Internal documents are versioned and migrated by `src/canvas/model.ts`.
- Standard JSON Canvas import/export is supported. Non-standard fields live under `x-cedrian` and unknown fields survive a round trip.
- IDs are UUIDs in normal editing. Nodes, edges, viewport, settings, parent groups and z-order are stable fields.
- Server saves use revisions so an older request cannot overwrite a newer document.
- Portal graphs are checked server-side and cyclic nesting is rejected.

## Performance

Nodes and edges are stored as entity maps. Undo/redo records changed entities instead of cloning the whole document. The viewport renders only nodes near the visible area, Markdown output is cached, images are lazy-loaded, dragging creates one history entry, and saves are debounced by 1100 ms.

Use these pages for repeatable browser checks:

- `/whiteboards/performance/?nodes=500` — 500 nodes and 700 edges.
- `/whiteboards/performance/` — 1000 nodes and 1500 edges.

Both pages display a live requestAnimationFrame rate. Playwright verifies that the canvases load and that only a bounded visible subset of nodes reaches the DOM.

## Verification

```sh
pnpm test-canvas
pnpm test-e2e
pnpm check
pnpm build
```

Before production deployment, apply `migrations/0010_whiteboards.sql` to the configured D1 database.
