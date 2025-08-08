import { greet } from '../src/index';

describe('greet', () => {
  it('should log "Hello, World!" to the console', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    greet('World');
    expect(consoleSpy).toHaveBeenCalledWith('Hello, World!');
    consoleSpy.mockRestore();
  });
});