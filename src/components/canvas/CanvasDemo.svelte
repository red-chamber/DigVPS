<script lang="ts">
import { localStorageAdapter } from "../../canvas/adapters";
import { createEdge, createNode, emptyDocument } from "../../canvas/model";
import AdvancedCanvasEditor from "./AdvancedCanvasEditor.svelte";

const document = emptyDocument("local-demo", "Local whiteboard demo");
const welcome = createNode("markdown", -330, -130, document.settings);
welcome.id = "demo-welcome";
welcome.width = 330;
welcome.height = 250;
welcome.data = {
	title: "Welcome",
	text: "# A canvas without walls\n\nDouble-click empty space to create a Markdown node.\n\n$$E = mc^2$$",
};
const link = createNode("link", 120, -30, document.settings);
link.id = "demo-link";
link.data = {
	title: "Cedrian Ian",
	text: "",
	url: "https://cedrian.cn/",
};
document.nodes = [welcome, link];
document.edges = [createEdge(welcome.id, link.id)];
document.viewport = { x: 520, y: 320, zoom: 1 };
const adapter = localStorageAdapter(document);
</script>

<AdvancedCanvasEditor documentId={document.id} {adapter} />
