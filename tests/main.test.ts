import { hello } from '../src/main';

describe('hello function test', () => {
    test('returning "Hello, world!"', () => {
        const res = hello('world');
        expect(res).toBe('Hello, world!');
    });
});
