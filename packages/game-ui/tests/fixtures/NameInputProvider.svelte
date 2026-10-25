<script lang="ts">
import type { NameField } from "@partygame/game-ui";
import type { BaseGameState } from "@partygame/shared/schema";
import NameInput from "../../src/components/NameInput.svelte";
import { setStrings } from "../../src/strings.js";

const { field }: { field: NameField<BaseGameState> } = $props();
setStrings({ yourName: "Context" });
</script>

<NameInput {field} />
