import { MiddlewareCallbackFunc } from './server';

export class RouterScope {
    url: string = '/';

    middlewares: MiddlewareCallbackFunc[] = [];
}
