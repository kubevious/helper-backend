import { Middleware, MiddlewareName } from './server';

export class MiddlewareRegistry {
    private _dict: Record<MiddlewareName, Middleware> = {};

    constructor() {}

    add(name: MiddlewareName, middleware: Middleware) {
        this._dict[name] = middleware;
    }

    get(name: MiddlewareName): Middleware {
        const value = this._dict[name];
        if (!value) {
            throw new Error(`Middleware ${name} not found.`);
        }
        return value;
    }
}
