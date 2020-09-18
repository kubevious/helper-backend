import { Middleware } from './index';

export class RouterScope {
    url: string = '/';

    middlewares: Middleware[] = [];
}
