import { expect, it } from 'vitest';
// Importing svelte files might need special handling
it('should import state', async () => {
    const state = await import('../src/state.svelte.js');
    expect(state).toBeDefined();
});
//# sourceMappingURL=svelte-state.test.js.map