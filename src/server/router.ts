import { Request, Response, Router as ExpressRouter, IRouterMatcher, NextFunction } from 'express';
import { AnySchema as JoiSchema } from 'joi';
import { ILogger } from 'the-logger';
import _ from 'the-lodash';
import { MyPromise, Resolvable } from 'the-promise';
import { MiddlewareCallbackFunc, MiddlewarePromiseFunc, MiddlewareRef } from './server';
import { RouterError, ErrorReporter } from './router-error';
import { RouterScope } from './router-scope';
import { MiddlewareInfo, MiddlewareKind, MiddlewareRegistry } from './middleware-registry';

export interface ParamsDictionary {
    [key: string]: string;
}

export type Handler<TReqParams = ParamsDictionary, TReqBody = any, TReqQuery = any, TLocals extends Record<string, any> = Record<string, any>> = 
    (req: Request<TReqParams, any, TReqBody, TReqQuery, TLocals>, res: Response<any, TLocals>) => Resolvable<any>;

export class Router {
    private _logger: ILogger;
    private _name: string;
    private _router: ExpressRouter;
    private _scope: RouterScope;
    private _middlewareRegistry: MiddlewareRegistry;
    private _errorReporter: ErrorReporter;
    private _executorScope: ExecutorScope;

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
        this._router = router;
        this._scope = scope;
        this._middlewareRegistry = middlewareRegistry;
        this._errorReporter = new ErrorReporter();

        this._executorScope = new ExecutorScope(logger, isDev);
    }

    url(value: string) {
        this._scope.url = value;
    }

    middleware(value: MiddlewareRef) {
        if (_.isString(value)) {
            const middlewareInfo = this._middlewareRegistry.get(value);
            this._activateMiddlewareInfo(middlewareInfo);
        } else {
            this._activateMiddlewareCallback(<MiddlewareCallbackFunc>value);
        }
    }

    get
    <TReqParams = ParamsDictionary, TReqBody = any, TReqQuery = any, TLocals extends Record<string, any> = Record<string, any> >
    (url: string, handler: Handler<TReqParams, TReqBody, TReqQuery, TLocals>)
    : RouteWrapper<TReqParams, TReqBody, TReqQuery, TLocals>
    {
        return this._setupRoute(url, handler, 'GET', this._router.get);
    }

    post
    <TReqParams = ParamsDictionary, TReqBody = any, TReqQuery = any, TLocals extends Record<string, any> = Record<string, any>>
    (url: string, handler: Handler<TReqParams, TReqBody, TReqQuery, TLocals>)
    : RouteWrapper<TReqParams, TReqBody, TReqQuery, TLocals>
    {
        return this._setupRoute(url, handler, 'POST', this._router.post);
    }

    put
    <TReqParams = ParamsDictionary, TReqBody = any, TReqQuery = any, TLocals extends Record<string, any> = Record<string, any>>
    (url: string, handler: Handler<TReqParams, TReqBody, TReqQuery, TLocals>)
    : RouteWrapper<TReqParams, TReqBody, TReqQuery, TLocals>
    {
        return this._setupRoute(url, handler, 'PUT', this._router.put);
    }

    delete
    <TReqParams = ParamsDictionary, TReqBody = any, TReqQuery = any, TLocals extends Record<string, any> = Record<string, any>>
    (url: string, handler: Handler<TReqParams, TReqBody, TReqQuery, TLocals>)
    : RouteWrapper<TReqParams, TReqBody, TReqQuery, TLocals>
    {
        return this._setupRoute(url, handler, 'DELETE', this._router.delete);
    }

    head
    <TReqParams = ParamsDictionary, TReqBody = any, TReqQuery = any, TLocals extends Record<string, any> = Record<string, any>>
    (url: string, handler: Handler<TReqParams, TReqBody, TReqQuery, TLocals>)
    : RouteWrapper<TReqParams, TReqBody, TReqQuery, TLocals>
    {
        return this._setupRoute(url, handler, 'HEAD', this._router.head);
    }

    options
    <TReqParams = ParamsDictionary, TReqBody = any, TReqQuery = any, TLocals extends Record<string, any> = Record<string, any>>
    (url: string, handler: Handler<TReqParams, TReqBody, TReqQuery, TLocals>)
    : RouteWrapper<TReqParams, TReqBody, TReqQuery, TLocals>
    {
        return this._setupRoute(url, handler, 'OPTIONS', this._router.options);
    }

    reportError(statusCode: number, message: string): void {
        this._errorReporter.reportError(statusCode, message);
    }

    reportUserError(message: string): void {
        this._errorReporter.reportUserError(message);
    }

    private _setupRoute<TReqParams, TReqBody, TReqQuery, TLocals extends Record<string, any> = Record<string, any>>
        (url: string, 
         handler: Handler<TReqParams, TReqBody, TReqQuery, TLocals>,
         method: string,
         matcher: IRouterMatcher<any>) 
        : RouteWrapper<TReqParams, TReqBody, TReqQuery, TLocals>
    {
        const routeHandler = new RouteHandler<TReqParams, TReqBody, TReqQuery, TLocals>(this._logger, this._name, method, url, this._executorScope);
        const routeWrapper = new RouteWrapper(routeHandler);
        matcher.bind(this._router)(url, (req, res) => {
            routeHandler.handle(
                ((<unknown>req) as Request<TReqParams, any, TReqBody, TReqQuery, TLocals>),
                 res as Response<any, TLocals>,
                 handler); 
        });
        return routeWrapper;
    }

    private _activateMiddlewareInfo(middlewareInfo: MiddlewareInfo)
    {
        if (middlewareInfo.kind == MiddlewareKind.Callback) {
            this._activateMiddlewareCallback(middlewareInfo.callback!)
        } else if (middlewareInfo.kind == MiddlewareKind.Promise) {
            this._activateMiddlewarePromise(middlewareInfo.promise!)
        } else {
            throw new Error(`Invalid middleware handler`);
        }
    }

    private _activateMiddlewareCallback(middleware: MiddlewareCallbackFunc)
    {
        const middlewareHandler = 
            (req: Request, res: Response, next: NextFunction) => 
            {
                try
                {
                    middleware(req, res, (error: any) => {
                        if (!error) {
                            next();
                        } else {
                            this._executorScope.handleError(res, error);
                        }
                    });
                }
                catch(error)
                {
                    this._executorScope.handleError(res, error);
                }
            };

        this._scope.middlewares.push(middlewareHandler);
    }

    private _activateMiddlewarePromise(middleware: MiddlewarePromiseFunc)
    {
        const middlewareHandler = 
            (req: Request, res: Response, next: NextFunction) => 
            {
                MyPromise.try(() => {
                        return middleware(req, res)
                    })
                    .then(() => {
                        next();
                        return null;
                    })
                    .catch(reason => {
                        this._executorScope.handleError(res, reason);
                        return null;
                    })
            };

        this._scope.middlewares.push(middlewareHandler);
    }

}

class RouteHandler<TReqParams, TReqBody, TReqQuery, TLocals extends Record<string, any> = Record<string, any>>
{
    private _logger: ILogger;
    private _name: string;
    private _method: string;
    private _url: string;
    private _isDev: boolean;
    private _bodySchema?: JoiSchema;
    private _paramsSchema?: JoiSchema;
    private _querySchema?: JoiSchema;
    private _executorScope: ExecutorScope;

    constructor(logger: ILogger, name: string, method: string, url: string, executorScope: ExecutorScope) {
        this._logger = logger;
        this._name = name;
        this._method = method;
        this._url = url;
        this._executorScope = executorScope;
        this._isDev = executorScope.isDev;
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

    handle(
        req: Request<TReqParams, any, TReqBody, TReqQuery, TLocals>,
        res: Response<any, TLocals>,
        handler: Handler<TReqParams, TReqBody, TReqQuery, TLocals>)
    {
        try {
            const validationError = this._validate(req);
            if (validationError) {
                this._executorScope.reportError(res, 400, { message: validationError! });
                return;
            }

            const handlerResult = handler(req, res);
            Promise.resolve(handlerResult)
                .then((result) => {
                    res.json(result);
                    return null;
                })
                .catch((reason) => {
                    this._executorScope.handleError(res, reason);
                    return null;
                });
        } catch (reason) {
            this._executorScope.handleError(res, reason);
        }
    }

    private _validate(req: Request<TReqParams, any, TReqBody, TReqQuery, TLocals>): string | undefined {
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


}

export class RouteWrapper<TReqParams, TReqBody, TReqQuery, TLocals extends Record<string, any> = Record<string, any>>
{
    private _handler: RouteHandler<TReqParams, TReqBody, TReqQuery, TLocals>;

    constructor(handler: RouteHandler<TReqParams, TReqBody, TReqQuery, TLocals>) {
        this._handler = handler;
    }

    bodySchema(schema: JoiSchema) {
        this._handler.setupBodyJoiValidator(schema);
        return this;
    }

    paramsSchema(schema: JoiSchema) {
        this._handler.setupParamsJoiValidator(schema);
        return this;
    }

    querySchema(schema: JoiSchema) {
        this._handler.setupQueryJoiValidator(schema);
        return this;
    }
}

class ExecutorScope
{
    private _logger: ILogger;
    private _isDev: boolean;

    constructor(logger: ILogger, isDev: boolean) {
        this._logger = logger;
        this._isDev = isDev;
    }

    get isDev() {
        return this._isDev;
    }

    handleError(res: Response, reason: any)
    {
        if (this._isDev) {
            this._logger.warn('[_handleError] ', reason);
        }

        const code = this._getCode(reason);
        const message = this._getMessage(reason);

        const body : any = {
            code: code,
            message: message,
        }

        if (this._isDev) {
            body.stack = this._getStack(reason);
        }

        if (code == 500) {
            this._logger.warn('[_handleError] SERVER ERROR: ', reason);
        }

        this.reportError(res, code, body);
    }

    reportError(res: Response, statusCode: number, body: any)
    {
        res.status(statusCode).json(body);
    }

    private _getCode(reason: any): number
    {
        if (reason instanceof RouterError)
        {
            if (_.isNumber(reason.statusCode)) {
                return reason.statusCode;
            }
        }
        else
        {
            if (_.isNumber(reason.status)) {
                return <number>reason.status;
            }

            if (_.isNumber(reason.code)) {
                return <number>reason.code;
            }

            if (_.isNumber(reason.statusCode)) {
                return <number>reason.statusCode;
            }
        }

        return 500;
    }

    private _getMessage(reason: any): string
    {
        let message: string = "";
        if (reason instanceof RouterError)
        {
            if (_.isString(reason.message)) {
                message = reason.message;
            }
        }
        else
        {
            if (_.isString(reason.message)) {
                message = reason.message;
            }
        }

        if (!message) {
            message = "Unknown internal error."
        }

        return message;
    }


    private _getStack(reason: any): string
    {
        let stack : string = "";
        if (reason.stack) {
            stack = reason.stack;
        }

        if (!stack) {
            stack = "Unknown stack"
        }

        return stack;
    }

}