import express from 'express';
import { Express, Request, Response, Router as ExpressRouter } from 'express';
import morgan from 'morgan';
import { Server as HttpServer } from 'http';
import _ from 'the-lodash';
import { ILogger } from 'the-logger'

import { Promise, Resolvable } from 'the-promise';
import path from 'path';
import fs from 'fs';
import { RouterError } from './router-error';
import { RouterWrapper } from './router-wrapper';

import dotenv from 'dotenv';
dotenv.config();

export type RouterFunc<TContext> = (builder: RouterBuilder<TContext>) => Router<TContext>;

export interface Router<TContext> {
    url: string,
    setup(logger: ILogger, router: RouterWrapper<TContext>, context: TContext) : void;
}

export class RouterBuilder<TContext> {

    private _server: Server<TContext>;
    private _logger : ILogger;
    private _router : ExpressRouter;
    private _wrapper? : RouterWrapper<TContext>;
    private _url? : string;

    constructor(server: Server<TContext>, logger : ILogger, router: ExpressRouter)
    {
        this._server = server;
        this._logger = logger;
        this._router = router;
    }

    getUrl() : string {
        return this._url!;
    }

    url(value: string) : RouterWrapper<TContext>
    {
        this._url = value;
        this._wrapper = new RouterWrapper(this._server, this._router, this._logger);
        return this._wrapper!;
    }   

    reportError(statusCode: number, message: string) {
        throw new RouterError(message, statusCode);
    }

    reportUserError(message: string)  {
        throw new RouterError(message, 400);
    }
    
    _build() : RouterWrapper<TContext>
    {
        return this._wrapper!;
    }
}

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
            const finalName = name + funcName;
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

        const router = express.Router();

        const logger = this.logger.sublogger("Router_" + name);

        const builder = new RouterBuilder(this, logger, router);

        routerModuleFunc(builder);

        const wrappedRouter = builder._build();

        // const wrappedRouter = new RouterWrapper<TContext>(this, router, logger);

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

        // routerModule.setup(routerContext);

        const middlewares : any[] = [];

        // middlewares.push(requestLogger(routerContext));
        // if (routerModule.needLogin) {
        //     middlewares.push(checkJwt)
        // }
        // if (routerModule.needUser) {
        //     middlewares.push(detectUser(routerContext))
        // }
        // if (routerModule.needProject) {
        //     middlewares.push(detectProject(routerContext))
        // }
        // if (routerModule.needCluster) {
        //     middlewares.push(detectCluster(routerContext))
        // }

        // routerModule.setup(routerContext);
        
        this._app.use(builder.getUrl(), middlewares, router);
    }

}