import { Request, Response, Router as ExpressRouter, IRouterMatcher } from 'express';
import { Server } from './index'
import { ILogger } from 'the-logger'
import { Promise, Resolvable } from 'the-promise';
import { RouterError } from './router-error';
import { RouterScope } from './router-scope';
import { Middleware } from './index';

import joi from 'joi';
import { AnySchema as JoiSchema } from 'joi'

export type Handler = (req : Request, res : Response) => Resolvable<any>;

export class Router<TContext> {
    
    private _server : Server<TContext>;
    private _logger : ILogger
    private _isDev : boolean
    private _router : ExpressRouter;
    private _scope : RouterScope;

    constructor(server : Server<TContext>, router : ExpressRouter, logger : ILogger, scope : RouterScope)
    {
        this._server = server;
        this._logger = logger;
        this._isDev = server.isDev;
        this._router = router;
        this._scope = scope;
    }

    url(value: string) {
        this._scope.url = value;
    }

    middleware(value : Middleware) {
        this._scope.middlewares.push(value);
    }

    get(url : string, handler: Handler) : RouteWrapper<TContext>
    {
        return this._setupRoute(url, handler, this._router.get);
    }

    post(url : string, handler: Handler) : RouteWrapper<TContext>
    {
        return this._setupRoute(url, handler, this._router.post);
    }

    put(url : string, handler: Handler) : RouteWrapper<TContext>
    {
        return this._setupRoute(url, handler, this._router.put);
    }

    delete(url : string, handler: Handler) : RouteWrapper<TContext>
    {
        return this._setupRoute(url, handler, this._router.delete);
    }

    head(url : string, handler: Handler) : RouteWrapper<TContext>
    {
        return this._setupRoute(url, handler, this._router.head);
    }

    options(url : string, handler: Handler) : RouteWrapper<TContext>
    {
        return this._setupRoute(url, handler, this._router.options);
    }

    reportError(statusCode: number, message: string) : void {
        throw new RouterError(message, statusCode);
    }

    reportUserError(message: string) : void {
        throw new RouterError(message, 400);
    }

    private _setupRoute<T>(url : string, handler: Handler, matcher: IRouterMatcher<T>) : RouteWrapper<TContext>
    {
        const routeHandler = new RouteHandler<TContext>(this._logger, this._isDev);
        const routeWrapper = new RouteWrapper<TContext>(routeHandler);
        matcher.bind(this._router)(url, (req, res) => {
            routeHandler.handle(req, res, handler)
        })
        return routeWrapper;
    }
    
}

class RouteHandler<TContext> {

    private _logger : ILogger
    private _isDev : boolean
    private _bodySchema?: JoiSchema
    private _paramsSchema?: JoiSchema

    constructor(logger : ILogger, isDev : boolean)
    {
        this._logger = logger;
        this._isDev = isDev;
    }

    setupBodyJoiValidator(schema: JoiSchema)
    {
        this._bodySchema = schema;
    }

    setupParamsJoiValidator(schema: JoiSchema)
    {
        this._paramsSchema = schema;
    }

    handle(req: Request, res : Response, handler: Handler)
    {
        try
        {
            const validationError = this._validate(req);
            if (validationError) {
                this._reportError(res, 400, { message: validationError! });
                return;
            }

            const handlerResult = handler(req, res);
            Promise.resolve(handlerResult)
                .then(result => {
                    res.json(result)
                }) 
                .catch((reason) => {
                    this._handleError(res, reason);
                });
        }
        catch(reason)
        {
            this._handleError(res, reason);
        }
    }

    _validate(req: Request) : string | undefined
    {
        if (this._bodySchema) {
            const joiResult = this._bodySchema!.validate(req.body);
            if (joiResult.error) {
                return joiResult.error!.message;
            }
        }

        if (this._paramsSchema) {
            const joiResult = this._paramsSchema!.validate(req.params);
            if (joiResult.error) {
                return joiResult.error!.message;
            }
        }
    }

    private _handleError(res: Response, reason : any)
    {
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

    private _reportError(res: Response, statusCode: number, body: any)
    {
        res.status(statusCode).json(body);
    }

}

export class RouteWrapper<TContext> {

    private _handler: RouteHandler<TContext>;

    constructor(handler: RouteHandler<TContext>)
    {
        this._handler = handler;
    }

    bodySchema(schema: JoiSchema) 
    {
        this._handler.setupBodyJoiValidator(schema);
    }

    paramsSchema(schema: JoiSchema) 
    {
        this._handler.setupParamsJoiValidator(schema);
    }

}