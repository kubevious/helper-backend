import { Request, Response, Router as ExpressRouter } from 'express';
import morgan from 'morgan'
import { Server } from './index'
import { ILogger } from 'the-logger'
import { Promise, Resolvable } from 'the-promise';
import { RouterError } from './router-error';

export type Handler = (req : Request, res : Response) => Resolvable<any>;

export class RouterWrapper<TContext> {
    
    private _server : Server<TContext>;
    private _logger : ILogger
    private _isDev : boolean
    private _router : ExpressRouter;
    
    constructor(server : Server<TContext>, router : ExpressRouter, logger : ILogger)
    {
        this._server = server;
        this._logger = logger;
        this._isDev = server.isDev;
        this._router = router;
    }

    get(url : string, handler: Handler)
    {
        this._router.get(url, (req, res) => {
            this._handleRoute(req, res, handler)
        })
    }

    post(url : string, handler: Handler)
    {
        this._router.post(url, (req, res) => {
            this._handleRoute(req, res, handler)
        })
    }

    put(url : string, handler: Handler)
    {
        this._router.put(url, (req, res) => {
            this._handleRoute(req, res, handler)
        })
    }

    delete(url : string, handler: Handler)
    {
        this._router.delete(url, (req, res) => {
            this._handleRoute(req, res, handler)
        })
    }

    _handleRoute(req: Request, res : Response, handler: Handler)
    {
        try
        {
            var result = handler(req, res);
            Promise.resolve(result)
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

    _handleError(res: Response, reason : any)
    {
        console.log(reason);
        
        if (this._isDev) {
            this._logger.error('[_handleError] ', reason);
        }
        if (reason instanceof RouterError) {
            let routerError = <RouterError>reason;
            if (this._isDev) {
                res.status(routerError.statusCode).json({ message: routerError.message, stack: routerError.stack });
            } else {
                res.status(routerError.statusCode).json({ message: routerError.message });
            }
        } else {
            var status = 500;
            if (this._isDev) {
                res.status(status).json({ message: reason.message, stack: reason.stack })
            } else {
                res.status(status).json({ message: reason.message })
            }
        }
    }
}