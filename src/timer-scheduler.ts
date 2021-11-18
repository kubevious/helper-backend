import _ from 'the-lodash';
import { ILogger } from 'the-logger' ;
import { Promise, Resolvable } from 'the-promise';

import { v4 as uuidv4 } from 'uuid';

export type TimerFunction = () => Resolvable<any>

export class TimerScheduler
{
    private _logger : ILogger;
    private _timers: Record<string, TimerInfo> = {};
    private _intervals: Record<string, TimerInfo> = {};

    constructor(logger : ILogger)
    {
        this._logger = logger;
        this._logger.info('[constructor]');
    }

    timer(timeoutMs: number, cb: TimerFunction) : TimerObject
    {
        this._logger.info('[timer] ');

        const id = uuidv4();

        const timerObj = setTimeout(() => {
            delete this._timers[id];
            this._triggerCallback(cb);
        }, timeoutMs);

        const timerInfo : TimerInfo = {
            id: id,
            handle: timerObj
        }

        this._timers[id] = timerInfo;

        return {
            close: () => {
                this._logger.info("[timer::close] id: %s", id);
                const info = this._timers[id];
                if (info) {
                    delete this._timers[id];
                    clearTimeout(info.handle);
                }
            }
        }
    }

    interval(timeoutMs: number, cb: TimerFunction) : TimerObject
    {
        this._logger.info('[interval] ');

        const id = uuidv4();

        const timerObj = setInterval(() => {
            this._triggerCallback(cb);
        }, timeoutMs);

        const timerInfo : TimerInfo = {
            id: id,
            handle: timerObj
        }

        this._intervals[id] = timerInfo;

        return {
            close: () => {
                this._logger.info("[interval::close] id: %s", id);
                const info = this._intervals[id];
                if (info) {
                    delete this._intervals[id];
                    this._logger.info("[interval::close] handle: %s", info.handle);
                    clearInterval(info.handle);
                }
            }
        }
    }

    close()
    {
        this._logger.info('[close]');

        for(const id of _.keys(this._intervals))
        {
            const info = this._intervals[id];
            this._logger.info('[close] clearInterval: %s', info.handle);
            clearInterval(info.handle);
        }
        this._intervals = {};

        for(const id of _.keys(this._timers))
        {
            const info = this._intervals[id];
            this._logger.info('[close] clearTimeout: %s', info.handle);
            clearTimeout(info.handle);
        }
        this._timers = {};
    }

    private _triggerCallback(cb: TimerFunction)
    {
        try
        {
            Promise.resolve(null)
                .then(() => cb())
                .catch(reason => {
                    this._logger.error("Failed in timer. ", reason);
                    return null;
                })
                .then(() => null);
        }
        catch(reason)
        {
            this._logger.error("Failed in timer. ", reason);
        }
    }

   
}

interface TimerInfo
{
    id: string;
    handle: NodeJS.Timeout;
}

export interface TimerObject
{
    close: () => void;
}