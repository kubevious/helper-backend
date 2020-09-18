import dotenv from 'dotenv';
dotenv.config();

import { ILogger, RootLogger, setupRootLogger, LoggerOptions, LogLevel } from 'the-logger';

export class Backend
{
    private _rootLogger : RootLogger;
    private _logger : ILogger;

    constructor(name : string)
    {
        // Process Setup
        process.stdin.resume();
        process.on('exit', this._exitHandler.bind(this, {cleanup:true}));

        //catches ctrl+c event
        process.on('SIGINT', this._exitHandler.bind(this, {exit:true}));

        // catches "kill pid" (for example: nodemon restart)
        process.on('SIGUSR1', this._exitHandler.bind(this, {exit:true}));
        process.on('SIGUSR2', this._exitHandler.bind(this, {exit:true}));

        //catches uncaught exceptions
        process.on('uncaughtException', this._exitHandler.bind(this, {exit:true}));

        // Logging
        const loggerOptions = new LoggerOptions();

        loggerOptions.pretty(true);

        if (process.env.LOG_TRACE)
        {
            loggerOptions.level(LogLevel.debug)
        }
        else
        {
            loggerOptions.level(LogLevel.info)
        }
        if (process.env.LOG_TO_FILE)
        {
            loggerOptions.enableFile(true);
            loggerOptions.cleanOnStart(true);
        }
        this._rootLogger = setupRootLogger(name, loggerOptions);
        this._logger = this._rootLogger.logger;
    }

    get logger() : ILogger {
        return this._logger;
    }

    close()
    {
        console.log('[Backend::close]');
        process.stdin.pause();
        // this._rootLogger.close();
    }

    private _exitHandler(options : any, exitCode : any) {
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