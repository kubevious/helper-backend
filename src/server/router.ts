import { Request, Response, Router as ExpressRouter, IRouterMatcher } from 'express';
import { AnySchema as JoiSchema } from 'joi';
import { ILogger } from 'the-logger';
import _ from 'the-lodash';
import { Promise, Resolvable } from 'the-promise';
import { Middleware, MiddlewareRef } from './server';
import { RouterError } from './router-error';
import { RouterScope } from './router-scope';
import { MiddlewareRegistry } from './middleware-registly';

export type Handler = (req: Request, res: Response) => Resolvable<any>;

export class Router {
    private _logger: ILogger;
    private _name: string;
    private _isDev: boolean;
    private _router: ExpressRouter;
    private _scope: RouterScope;
    private _middlewareRegistry: MiddlewareRegistry;

    constructor(
        name: string,
        isDev: boolean,
        router: ExpressRouter,
        logger: ILogger,
        scope: RouterScope,
        middlewareRegistry: MiddlewareRegistry,
    ) {
        this._logger = logger;
        this._name = name;
        this._isDev = isDev;
        this._router = router;
        this._scope = scope;
        this._middlewareRegistry = middlewareRegistry;
    }

    url(value: string) {
        this._scope.url = value;
    }

    middleware(value: MiddlewareRef) {
        if (_.isString(value)) {
            const middleware = this._middlewareRegistry.get(value);
            this._scope.middlewares.push(middleware);
        } else {
            this._scope.middlewares.push(<Middleware>value);
        }
    }

    get(url: string, handler: Handler): RouteWrapper {
        return this._setupRoute(url, handler, 'GET', this._router.get);
    }

    post(url: string, handler: Handler): RouteWrapper {
        return this._setupRoute(url, handler, 'POST', this._router.post);
    }

    put(url: string, handler: Handler): RouteWrapper {
        return this._setupRoute(url, handler, 'PUT', this._router.put);
    }

    delete(url: string, handler: Handler): RouteWrapper {
        return this._setupRoute(url, handler, 'DELETE', this._router.delete);
    }

    head(url: string, handler: Handler): RouteWrapper {
        return this._setupRoute(url, handler, 'HEAD', this._router.head);
    }

    options(url: string, handler: Handler): RouteWrapper {
        return this._setupRoute(url, handler, 'OPTIONS', this._router.options);
    }

    reportError(statusCode: number, message: string): void {
        throw new RouterError(message, statusCode);
    }

    reportUserError(message: string): void {
        throw new RouterError(message, 400);
    }

    private _setupRoute<T>(url: string, handler: Handler, method: string, matcher: IRouterMatcher<T>): RouteWrapper {
        const routeHandler = new RouteHandler(this._logger, this._name, method, url, this._isDev);
        const routeWrapper = new RouteWrapper(routeHandler);
        matcher.bind(this._router)(url, (req, res) => {
            routeHandler.handle(req, res, handler);
        });
        return routeWrapper;
    }
}

class RouteHandler {
    private _logger: ILogger;
    private _name: string;
    private _method: string;
    private _url: string;
    private _isDev: boolean;
    private _bodySchema?: JoiSchema;
    private _paramsSchema?: JoiSchema;
    private _querySchema?: JoiSchema;

    constructor(logger: ILogger, name: string, method: string, url: string, isDev: boolean) {
        this._logger = logger;
        this._isDev = isDev;
        this._name = name;
        this._method = method;
        this._url = url;
    }

    setupBodyJoiValidator(schema: JoiSchema) {
        this._bodySchema = schema;
    }

    setupParamsJoiValidator(schema: JoiSchema) {
        this._paramsSchema = schema;
    }

    setupQueryJoiValidator(schema: JoiSchema) {
        this._querySchema = schema;
    }

    handle(req: Request, res: Response, handler: Handler) {
        try {
            const validationError = this._validate(req);
            if (validationError) {
                this._reportError(res, 400, { message: validationError! });
                return;
            }

            const handlerResult = handler(req, res);
            Promise.resolve(handlerResult)
                .then((result) => {
                    res.json(result);
                })
                .catch((reason) => {
                    this._handleError(res, reason);
                });
        } catch (reason) {
            this._handleError(res, reason);
        }
    }

    _validate(req: Request): string | undefined {
        if (this._bodySchema) {
            const joiResult = this._bodySchema!.validate(req.body);
            if (joiResult.error) {
                const msg = joiResult.error!.message;
                if (this._isDev) {
                    this._logger.warn("[Router] %s :: %s :: %s body schema validation error: %s", this._name, this._method, this._url, msg);
                }
                return msg;
            }
        }

        if (this._paramsSchema) {
            const joiResult = this._paramsSchema!.validate(req.params);
            if (joiResult.error) {
                const msg = joiResult.error!.message;
                if (this._isDev) {
                    this._logger.warn("[Router] %s :: %s :: %s params schema validation error: %s", this._name, this._method, this._url, msg);
                }
                return msg;
            }
        }

        if (this._querySchema) {
            const joiResult = this._querySchema!.validate(req.query);
            if (joiResult.error) {
                const msg = joiResult.error!.message;
                if (this._isDev) {
                    this._logger.warn("[Router] %s :: %s :: %s query schema validation error: %s", this._name, this._method, this._url, msg);
                }
                return msg;
            }
        }
    }

    private _handleError(res: Response, reason: any) {
        if (this._isDev) {
            this._logger.error('[_handleError] ', reason);
        }
        if (reason instanceof RouterError) {
            let routerError = <RouterError>reason;
            let body;
            if (this._isDev) {
                body = { message: routerError.message, stack: routerError.stack };
            } else {
                body = { message: routerError.message };
            }
            this._reportError(res, routerError.statusCode, body);
        } else {
            let body;
            if (this._isDev) {
                body = { message: reason.message, stack: reason.stack };
            } else {
                body = { message: reason.message };
            }
            this._reportError(res, 500, body);
        }
    }

    private _reportError(res: Response, statusCode: number, body: any) {
        res.status(statusCode).json(body);
    }
}

export class RouteWrapper {
    private _handler: RouteHandler;

    constructor(handler: RouteHandler) {
        this._handler = handler;
    }

    bodySchema(schema: JoiSchema) {
        this._handler.setupBodyJoiValidator(schema);
    }

    paramsSchema(schema: JoiSchema) {
        this._handler.setupParamsJoiValidator(schema);
    }

    querySchema(schema: JoiSchema) {
        this._handler.setupQueryJoiValidator(schema);
    }
}
