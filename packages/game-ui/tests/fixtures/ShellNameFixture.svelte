<script lang="ts">
function takeFocus(node: HTMLInputElement): void {
  node.focus();
}
</script>

<h2 tabindex="-1">Name heading</h2>
<input use:takeFocus aria-label="Lobby name" />
