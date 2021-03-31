import express from 'express';
import { Express, Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { Server as HttpServer } from 'http';
import path from 'path';
import fs from 'fs';
import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { Router } from './router';
import { RouterScope } from './router-scope';
import { MiddlewareRegistry } from './middleware-registry';

import dotenv from 'dotenv';
import { ErrorReporter } from './router-error';
dotenv.config();

export type RouterFunc<TContext, THelpers> = (router: Router, context: TContext, logger : ILogger, helpers: THelpers) => void;
export type ExpressAppFunc = (app: Express) => void;

export type MiddlewareCallbackFunc = (req: Request, res: Response, next: NextFunction) => void;
export type MiddlewarePromiseFunc = (req: Request, res: Response) => Promise<any> | void;
export type MiddlewareName = string;
export type MiddlewareRef = MiddlewareCallbackFunc | MiddlewareName;
export type MiddlewareFunctionBuilder<TContext, THelpers> = (context: TContext, logger: ILogger, errorReporter: ErrorReporter, helpers: THelpers) => MiddlewareCallbackFunc;
export type MiddlewarePromiseBuilder<TContext, THelpers> = (context: TContext, logger: ILogger, errorReporter: ErrorReporter, helpers: THelpers) => MiddlewarePromiseFunc;

export interface ServerParams
{
    staticHostingPath? : string
}

export class Server<TContext, THelpers> {
    private _context: TContext;
    private _helpers: THelpers;
    private _app: Express;
    private _httpServer?: HttpServer;
    private _isDev: boolean;
    private _logger: ILogger;
    private _port: number;
    private _routersDir: string;
    private _appInitCb?: ExpressAppFunc;
    private _middlewareRegistry = new MiddlewareRegistry();
    private _errorReporter = new ErrorReporter();
    private _serverParams? : ServerParams;

    constructor(logger: ILogger, context: TContext, port: number, routersDir: string, helpers: THelpers, params? : ServerParams) {
        this._context = context;
        this._logger = logger.sublogger('Server');
        this._routersDir = routersDir;
        this._port = port;
        this._helpers = helpers;
        this._logger.info("NODE_ENV= %s", process.env.NODE_ENV);
        this._isDev = process.env.NODE_ENV === 'development';
        this._serverParams = params;

        this._app = express();
    }

    get logger(): ILogger {
        return this._logger;
    }

    get context(): TContext {
        return this._context;
    }

    get httpServer(): HttpServer {
        return this._httpServer!;
    }

    get port() {
        return this._port;
    }

    get helpers() {
        return this._helpers;
    }

    markDev() {
        this._logger.info("[markDev]");
        this._isDev = true;
    }

    middleware(name: MiddlewareName, builder: MiddlewareFunctionBuilder<TContext, THelpers>) {
        const middleware = builder(this.context, this.logger, this._errorReporter, this._helpers);
        this._middlewareRegistry.addFunc(name, middleware);
    }

    middlewareP(name: MiddlewareName, builder: MiddlewarePromiseBuilder<TContext, THelpers>) {
        const middleware = builder(this.context, this.logger, this._errorReporter, this._helpers);
        this._middlewareRegistry.addPromise(name, middleware);
    }

    initializer(cb: ExpressAppFunc) {
        this._appInitCb = cb;
    }

    run(): Promise<Server<TContext, THelpers>> {
        this._logger.info("[run] isDev=%s", this._isDev);

        if (this._isDev) {
            this._app.use(morgan('dev'));
        }

        this._app.use(express.json({ limit: '10mb' }));

        if (this._appInitCb) {
            this._appInitCb!(this._app);
        }

        this._loadRouters();

        this._app.use((err: any, req: Request, res: Response, next: NextFunction) => {
            if (err) {
                this.logger.error(err);
                res.status(err.status).json({ message: err.message });
                return;
            }
            next();
        });

        if (this._serverParams) {
            if (this._serverParams.staticHostingPath) {
                this._app.use(express.static(this._serverParams.staticHostingPath));
            }
        }

        return Promise.construct((resolve, reject) => {
            this._httpServer = this._app.listen(this._port, () => {
                this.logger.info('Listening on port %s', this._port);
                resolve(this);
            });
        });
    }

    close() {
        if (this._httpServer) {
            this.logger.info('Closing...');
            this._httpServer!.close(() => {
                this.logger.info('Closed.');
            });
            this._httpServer = undefined;
        }
    }

    _loadRouters() {
        if (!this._routersDir) {
            return;
        }
        var routerNames = fs.readdirSync(this._routersDir);
        routerNames = routerNames.filter((x) => path.extname(x).toLocaleLowerCase() == '.ts');
        routerNames = routerNames.map((x) => {
            var name = path.parse(x).name;
            if (path.extname(name).toLocaleLowerCase() == '.d')
            {
                name = path.parse(name).name;
            }
            return name;
        });
        for (var x of routerNames) {
            this._loadRouter(x);
        }
    }

    _loadRouter(name: string) {
        this.logger.info('Loading router %s...', name);
        const routerModule = require(path.join(this._routersDir, name));

        for (let funcName of _.keys(routerModule)) {
            const finalName = name + '-' + funcName;
            const routerModuleFuncAny = _.get(routerModule, funcName);

            const routerModuleFunc = <RouterFunc<TContext, THelpers>>routerModuleFuncAny;
            if (routerModuleFunc) {
                this.logger.info('Loading router func %s...', finalName);
                this._loadRouterFunction(finalName, routerModuleFunc);
            } else {
                this.logger.error('Failed to load router module func: %s', finalName);
            }
        }
    }

    _loadRouterFunction(name: string, routerModuleFunc: RouterFunc<TContext, THelpers>) {
        const expressRouter = express.Router();

        const logger = this.logger.sublogger('Router_' + name);

        const routerScope = new RouterScope();
        const router = new Router(name, this._isDev, expressRouter, logger, routerScope, this._middlewareRegistry);

        routerModuleFunc(router, this.context, logger, this._helpers);

        this._app.use(routerScope.url, routerScope.middlewares, expressRouter);
    }
}
