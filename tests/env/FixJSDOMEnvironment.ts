// https://github.com/jsdom/jsdom/issues/3363#issuecomment-1467894943

import JSDOMEnvironment from 'jest-environment-jsdom';

export default class FixJSDOMEnvironment extends JSDOMEnvironment {
    constructor(...args: ConstructorParameters<typeof JSDOMEnvironment>) {
        super(...args);

        this.global.structuredClone = structuredClone;
    }
}
