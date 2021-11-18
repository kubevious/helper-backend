import dotenv from 'dotenv';
dotenv.config();

import { ILogger, RootLogger, setupRootLogger, LoggerOptions, LogLevel } from 'the-logger';
import { Resolvable, Promise } from 'the-promise';
import _ from 'the-lodash';

import { ProcessingTracker } from './processing-tracker';
import { TimerScheduler } from './timer-scheduler';

export type AnyFunction = () => Resolvable<any> 
export interface BackendOptions 
{
    logLevels?: Record<string, LogLevel>;
    skipProcessExit?: boolean;
}

interface BackendStage
{
    name: string,
    setup: AnyFunction,
    cleanup?: AnyFunction
}

export class Backend {
    private _options : BackendOptions;
    private _rootLogger: RootLogger;
    private _logger: ILogger;

    private _errorHandler? : (reason: any) => any;
    private _exitCode = 0;
    private _stages: BackendStage[] = [];

    private _timerScheduler : TimerScheduler;
    private _tracker : ProcessingTracker;

    constructor(name: string, options? : BackendOptions) {
        // Process Setup
        process.stdin.resume();
        process.on('exit', this._exitHandler.bind(this, <EventOptions>{ event: 'exit', cleanup: true }));

        //k8s pre kill event
        process.on('SIGTERM', this._exitHandler.bind(this, <EventOptions>{ event: 'SIGTERM', cleanup: true, exit: true }));

        //catches ctrl+c event
        process.on('SIGINT', this._exitHandler.bind(this, <EventOptions>{ event: 'SIGINT', exit: true }));

        // catches "kill pid" (for example: nodemon restart)
        process.on('SIGUSR1', this._exitHandler.bind(this, <EventOptions>{ event: 'SIGUSR1', exit: true }));
        process.on('SIGUSR2', this._exitHandler.bind(this, <EventOptions>{ event: 'SIGUSR2', exit: true }));

        //catches uncaught exceptions
        process.on('uncaughtException', this._uncaughtException.bind(this));

        //catches uncaught exceptions
        process.on('unhandledRejection', this._unhandledRejection.bind(this));

        this._options = options || {};

        // Logging
        const loggerOptions = new LoggerOptions();

        loggerOptions.pretty(true);

        let logLevel = LogLevel.info;
        if (process.env.LOG_LEVEL) {
            logLevel = <LogLevel>process.env.LOG_LEVEL;
        }
        loggerOptions.level(logLevel);

        if (process.env.LOG_TO_FILE &&
            (process.env.LOG_TO_FILE == 'true' || process.env.LOG_TO_FILE == 'yes'))
        {
            loggerOptions.enableFile(true);
            loggerOptions.cleanOnStart(true);
        }

        if (this._options.logLevels) {
            for(const name of _.keys(this._options.logLevels))
            {
                loggerOptions.subLevel(name, this._options.logLevels[name]);
            }
        }

        const LogLevelOverridePrefix = 'LOG_LEVEL_'
        for(const key of _.keys(process.env).filter(x => _.startsWith(x, LogLevelOverridePrefix)))
        {
            const sublevelName = key.substring(LogLevelOverridePrefix.length);
            const logLevel = <LogLevel>process.env[key];
            loggerOptions.subLevel(sublevelName, logLevel);
        }

        this._rootLogger = setupRootLogger(name, loggerOptions);
        this._logger = this._rootLogger.logger;

        this._timerScheduler = new TimerScheduler(this.logger.sublogger("TimerScheduler"));

        this._tracker = new ProcessingTracker(this.logger.sublogger("Tracker"), this._timerScheduler);
        this._tracker.enablePeriodicDebugOutput();
    }

    get logger(): ILogger {
        return this._logger;
    }

    get rootLogger() {
        return this._rootLogger;
    }

    get timerScheduler() {
        return this._timerScheduler;
    }

    get tracker() : ProcessingTracker {
        return this._tracker;
    }

    stage(name: string, setup: AnyFunction, options?: {
        cleanup?: AnyFunction,
        kill?: AnyFunction
    })
    {
        this.logger.info("Stage: %s", name);

        this._stages.push({
            name: name,
            setup: setup
            // cleanup: cleanup
        });
    }

    run()
    {
        this.execute('run', () => {

            return Promise.serial(this._stages, x => {
                this.logger.info("[run] stage: %s begin...", x.name);
                return x.setup();
            })

        }, (reason) => {
            this.logger.error('[run] FAILED. Application will now exit. Reason: ', reason);
            this._handleError(reason);
        })
    }

    initialize(cb : AnyFunction)
    {
        this.logger.error('[DEPRECATED] use backend.stage and backend.run instead.');
        this.execute('initialize', cb, (reason) => {
            this.logger.error('[initialize] FAILED. Application will now exit. Reason: ', reason);
            this._handleError(reason);
        })
    }

    execute(name: string, cb : AnyFunction, handleError?: (reason: any) => void)
    {
        this.logger.info('[execute] %s :: Begin.', name);
        Promise.try(cb)
            .then(() => {
                this.logger.info('[execute] %s :: End.', name);
                return null;
            })
            .catch((reason : any) => {
                this.logger.error('[execute] %s :: Failed. Reason: ', name, reason);
                if (handleError) {
                    this._handleError(reason);
                }
                return null;
            })
            .then(() => null);
    }

    registerErrorHandler(errorHandler? : (reason: any) => any)
    {
        this._errorHandler = errorHandler;
    }

    close() {
        console.log('[Backend::close]');
        
        this._tracker.close();
        this._timerScheduler.close();

        process.stdin.pause();
        // this._rootLogger.close();

        if (!this._options.skipProcessExit) {
            process.exit(this._exitCode);
        }
    }

    private _uncaughtException(reason: any)
    {
        this.logger.error('[_uncaughtException] Reason: ', reason);
        this._handleError(reason);
    }

    private _unhandledRejection(reason: any)
    {
        this.logger.error('[_unhandledRejection] Reason: ', reason);
        this._handleError(reason);
    }

    private _handleError(reason: any)
    {
        this.logger.error('[_handleError] Reason: ', reason);
        this._exitCode = 1;

        Promise.resolve(null)
            .then(() => {
                if (this._errorHandler)
                {
                    this._errorHandler!(reason);
                }
                return null
            })
            .catch((reason : any) => {
                this.logger.error('[Backend::_handleError] FAILED. Reason:', reason);
                return null;
            })
            .then(() => {
                this.close();
                return null;
            })
            .then(() => null);
    }

    private _exitHandler(options: EventOptions, exitCode: any) {
        console.log('[Backend::_exitHandler] event: ', options.event);

        if (options.cleanup) {
            console.log('[Backend::_exitHandler] cleanup');
        }

        if (exitCode || exitCode === 0) {
            console.log('[Backend::_exitHandler] exiting with: ', exitCode);
        }

        if (options.exit) {
            console.log('[Backend::_exitHandler] the end.');
            this.close();
        }
    }
}

interface EventOptions { 
    event: string,
    cleanup?: boolean,
    exit?: boolean
}