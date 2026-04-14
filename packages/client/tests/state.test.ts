import { expect, it, describe, vi } from 'vitest';
import { GameClient } from '../src/GameClient.js';
describe('GameClient', () => {
    it('should initialize with correct roomCode and default connection status', () => {
        const client = new GameClient({ roomCode: 'TEST' });
        expect(client.connectionStatus).toBe('connecting');
        expect(client.state).toBeDefined();
    });
    it('should sync state when onStateChange is called', () => {
        const client = new GameClient({ roomCode: 'TEST' });
        const spy = vi.spyOn(client.state, 'sync');
        const mockState = { count: 5 };
        client.onStateChange(mockState);
        expect(spy).toHaveBeenCalledWith(mockState);
        expect(client.state.count).toBe(5);
    });
});
//# sourceMappingURL=state.test.js.map