import { MiddlewareCallbackFunc, MiddlewarePromiseFunc, MiddlewareName } from './server';

export class MiddlewareRegistry
{
    private _dict: Record<MiddlewareName, MiddlewareInfo> = {};

    constructor()
    {

    }

    addFunc(name: MiddlewareName, middleware: MiddlewareCallbackFunc) {
        this._dict[name] = {
            kind: MiddlewareKind.Callback,
            callback: middleware
        }
    }

    addPromise(name: MiddlewareName, middleware: MiddlewarePromiseFunc) {
        this._dict[name] = {
            kind: MiddlewareKind.Promise,
            promise: middleware
        }
    }

    get(name: MiddlewareName): MiddlewareInfo {
        const value = this._dict[name];
        if (!value) {
            throw new Error(`Middleware ${name} not found.`);
        }
        return value;
    }
}

export enum MiddlewareKind
{
    Callback,
    Promise
}

export interface MiddlewareInfo
{
    kind: MiddlewareKind,
    callback?: MiddlewareCallbackFunc,
    promise?: MiddlewarePromiseFunc
}