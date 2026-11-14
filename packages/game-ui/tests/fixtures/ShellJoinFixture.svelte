<script lang="ts">
function takeFocus(node: HTMLInputElement): void {
  node.focus();
}
</script>

<h2 tabindex="-1">Join heading</h2>
<input use:takeFocus aria-label="Late name" />
