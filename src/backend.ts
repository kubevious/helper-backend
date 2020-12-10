import dotenv from 'dotenv';
dotenv.config();

import { ILogger, RootLogger, setupRootLogger, LoggerOptions, LogLevel } from 'the-logger';
import { Resolvable, Promise } from 'the-promise';
import _ from 'the-lodash';
import { v4 as uuidv4 } from 'uuid';

export type TimerFunction = () => Resolvable<any>

export class Backend {
    private _rootLogger: RootLogger;
    private _logger: ILogger;
    private _timers: Record<string, NodeJS.Timeout> = {};
    private _intervals: NodeJS.Timeout[] = [];

    constructor(name: string) {
        // Process Setup
        process.stdin.resume();
        process.on('exit', this._exitHandler.bind(this, { cleanup: true }));

        //catches ctrl+c event
        process.on('SIGINT', this._exitHandler.bind(this, { exit: true }));

        // catches "kill pid" (for example: nodemon restart)
        process.on('SIGUSR1', this._exitHandler.bind(this, { exit: true }));
        process.on('SIGUSR2', this._exitHandler.bind(this, { exit: true }));

        //catches uncaught exceptions
        process.on('uncaughtException', this._exitHandler.bind(this, { exit: true }));

        // Logging
        const loggerOptions = new LoggerOptions();

        loggerOptions.pretty(true);

        if (process.env.LOG_TRACE) {
            loggerOptions.level(LogLevel.debug);
        } else {
            loggerOptions.level(LogLevel.info);
        }
        if (process.env.LOG_TO_FILE) {
            loggerOptions.enableFile(true);
            loggerOptions.cleanOnStart(true);
        }
        this._rootLogger = setupRootLogger(name, loggerOptions);
        this._logger = this._rootLogger.logger;
    }

    get logger(): ILogger {
        return this._logger;
    }

    initialize(cb : () => any)
    {
        this.logger.error('[Backend::initialize] Begin.');
        Promise.resolve()
            .then(() => cb())
            .then(() => {
                this.logger.error('[Backend::initialize] End.');
            })
            .catch((reason : any) => {
                this.logger.error('[Backend::initialize] FAILED. Application will now exit. Reason: ', reason);
                this.close();
            })
            .then(() => null);
    }

    close() {
        console.log('[Backend::close]');
        this._terminateTimers();
        process.stdin.pause();
        // this._rootLogger.close();
    }

    timer(timeout: number, cb: TimerFunction)
    {
        const id = uuidv4();
        
        const timerObj = setTimeout(() => {
            delete this._timers[id];
            this._triggerCallback(cb);
        }, timeout);

        this._timers[id] = timerObj;
    }

    interval(timeout: number, cb: TimerFunction)
    {
        const timerObj = setInterval(() => {
            this._triggerCallback(cb);
        }, timeout);

        this._intervals.push(timerObj);
    }

    private _triggerCallback(cb: TimerFunction)
    {
        try
        {
            const value = cb();
            Promise.resolve(value)
                .catch(reason => {
                    this._logger.error("Failed in timer. ", reason);
                })
                .then(() => null);
        }
        catch(reason)
        {
            this._logger.error("Failed in timer. ", reason);
        }
    }

    private _terminateTimers()
    {
        for(let timerObj of this._intervals)
        {
            clearInterval(timerObj);
        }
        this._intervals = [];

        for(let id of _.keys(this._timers))
        {
            clearTimeout(this._timers[id]);
        }
        this._timers = {};
    }

    private _exitHandler(options: any, exitCode: any) {
        if (options.cleanup) {
            console.log('[Backend::_exitHandler] cleanup');
        }

        if (exitCode || exitCode === 0) {
            console.log('[Backend::_exitHandler] exiting with: ' + exitCode);
        }

        if (options.exit) {
            console.log('[Backend::_exitHandler] the end.');
            process.exit();
        }
    }
}
