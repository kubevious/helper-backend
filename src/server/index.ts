import express from 'express';
import { Express, Request, Response, Router as ExpressRouter, NextFunction } from 'express';
import morgan from 'morgan';
import { Server as HttpServer } from 'http';
import path from 'path';
import fs from 'fs';
import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { Router } from './router';
import { RouterScope } from './router-scope';
import { MiddlewareRegistry } from './middleware-registly';

import dotenv from 'dotenv';
dotenv.config();

export type RouterFunc<TContext> = (router: Router, context: TContext) => void;
export type ExpressAppFunc = (app: Express) => void;

export type Middleware = (req: Request, res: Response, next: NextFunction) => void;
export type MiddlewareName = string;
export type MiddlewareRef = Middleware | MiddlewareName;

export class Server<TContext> {
    private _context: TContext;
    private _app: Express;
    private _httpServer?: HttpServer;
    private _isDev: boolean;
    private _logger: ILogger;
    private _port: number;
    private _routersDir: string;
    private _appInitCb?: ExpressAppFunc;
    private _middlewareRegistry = new MiddlewareRegistry();

    constructor(logger: ILogger, context: TContext, port: number, routersDir: string) {
        this._context = context;
        this._logger = logger.sublogger('Server');
        this._routersDir = routersDir;
        this._port = port;
        this._app = express();
        this._isDev = process.env.NODE_ENV === 'development';
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

    middleware(name: MiddlewareName, middleware: Middleware) {
        this._middlewareRegistry.add(name, middleware);
    }

    initializer(cb: ExpressAppFunc) {
        this._appInitCb = cb;
    }

    run(): Promise<Server<TContext>> {
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
        routerNames = routerNames.map((x) => path.parse(x).name);
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

            const routerModuleFunc = <RouterFunc<TContext>>routerModuleFuncAny;
            if (routerModuleFunc) {
                this.logger.info('Loading router func %s...', finalName);
                this._loadRouterFunction(finalName, routerModuleFunc);
            } else {
                this.logger.error('Failed to load router module func: %s', finalName);
            }
        }
    }

    _loadRouterFunction(name: string, routerModuleFunc: RouterFunc<TContext>) {
        const expressRouter = express.Router();

        const logger = this.logger.sublogger('Router_' + name);

        const routerScope = new RouterScope();
        const router = new Router(this._isDev, expressRouter, logger, routerScope, this._middlewareRegistry);

        routerModuleFunc(router, this.context);

        this._app.use(routerScope.url, routerScope.middlewares, expressRouter);
    }
}
