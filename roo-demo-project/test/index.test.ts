describe('greet', () => {
  it('should log "Hello, World!" to the console', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    require('../src/index');
    expect(consoleSpy).toHaveBeenCalledWith('Hello, World!');
    consoleSpy.mockRestore();
  });
});