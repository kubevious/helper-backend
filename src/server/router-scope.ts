import { Middleware } from './server';

export class RouterScope {
    url: string = '/';

    middlewares: Middleware[] = [];
}
