import express from 'express';
import { Express, Request, Response, Router as ExpressRouter } from 'express';
import morgan from 'morgan';
import { Server as HttpServer } from 'http';
import path from 'path';
import fs from 'fs';
import _ from 'the-lodash';
import { ILogger } from 'the-logger'
import { RouterError } from './router-error';
import { Router } from './router';
import { RouterScope } from './router-scope';

import dotenv from 'dotenv';
dotenv.config();

import joi from 'joi';
import { AnySchema } from 'joi'

export type RouterFunc<TContext> = (builder: Router<TContext>) => void;

export type Middleware = (req : Request, res : Response, next : (error: any) => void) => void;

export class Server<TContext>
{
    private _context : TContext;
    private _app : Express;
    private _httpServer? : HttpServer;
    public isDev = false;
    private _logger : ILogger;
    private _port : number;
    private _routersDir : string;

    constructor(logger: ILogger, context : TContext, port : number, routersDir : string)
    {
        this._context = context;
        this._logger = logger.sublogger("Server");
        this._routersDir = routersDir;
        this._port = port;
        this._app = express();
        this.isDev = (process.env.NODE_ENV === 'development');
    }

    get logger() {
        return this._logger;
    }

    get httpServer() : HttpServer {
        return this._httpServer!;
    }

    run()
    {
        if (this.isDev)
        {
            this._app.use(morgan('dev'))
        }

        this._app.use(express.json({limit: '10mb'}));

        // const session = {
        //     secret: process.env.SESSION_SECRET,
        //     cookie: {},
        //     resave: false,
        //     saveUninitialized: false
        // };

        // if (this._app.get('env') === 'production') {
        //     session.cookie.secure = true;
        // }

        // this._app.use(expressSession(session));

        this._loadRouters();

        this._app.use((err : any, req : Request, res : Response, next : () => any) => {
            if (err) {
                this.logger.error(err);
                res.status(err.status).json({ message: err.message });
                return;
            }
            next();
        });

        this._httpServer = this._app.listen(this._port, () => {
            this.logger.info("Listening on port %s", this._port);
        });
    }

    close()
    {
        if (this._httpServer)
        {
            this.logger.info("Closing...");
            this._httpServer!.close(() => {
                this.logger.info("Closed.");
            })
            this._httpServer = undefined;
        }
    }

    _loadRouters()
    {
        if (!this._routersDir) {
            return;
        }
        var routerNames = fs.readdirSync(this._routersDir);
        routerNames = routerNames.map(x => path.parse(x).name);
        for(var x of routerNames)
        {
            this._loadRouter(x);
        }
    }

    _loadRouter(name: string) {
        this.logger.info("Loading router %s...", name);
        const routerModule = require(path.join(this._routersDir, name))

        for(let funcName of _.keys(routerModule))
        {
            const finalName = name + '-' + funcName;
            const routerModuleFuncAny = _.get(routerModule, funcName);

            const routerModuleFunc = <RouterFunc<TContext>>routerModuleFuncAny;
            if (routerModuleFunc)
            {
                this.logger.info("Loading router func %s...", finalName);
                this._loadRouterFunction(finalName, routerModuleFunc);
            }
            else 
            {
                this.logger.error("Failed to load router module func: %s", finalName);
            }
        }
    }

    _loadRouterFunction(name: string, routerModuleFunc: RouterFunc<TContext>) {

        const expressRouter = express.Router();

        const logger = this.logger.sublogger("Router_" + name);

        const routerScope = new RouterScope();
        const router = new Router(this, expressRouter, logger, routerScope);

        routerModuleFunc(router);

        // const routerContext = {
        //     logger: logger,
        //     app: this._app,
        //     context: this._context,
        //     // dataStore: this._context.dataStore,
        //     router: wrappedRouter,
        //     reportError: (statusCode: number, message: string) => {
        //         throw new RouterError(message, statusCode);
        //     },
        //     reportUserError: (message: string) => {
        //         throw new RouterError(message, 400);
        //     }
        // }
        
        this._app.use(routerScope.url, routerScope.middlewares, expressRouter);
    }

}