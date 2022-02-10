import _ from 'the-lodash';
import { ILogger } from 'the-logger' ;
import { Promise, Resolvable } from 'the-promise';

import { v4 as uuidv4 } from 'uuid';

export type TimerFunction = () => Resolvable<any>

export class TimerScheduler
{
    private _logger : ILogger;
    private _timers: Record<string, TimerInfo> = {};

    constructor(logger : ILogger)
    {
        this._logger = logger;
        this._logger.info('[constructor]');
    }

    timer(name: string, timeoutMs: number, cb: TimerFunction) : TimerObject
    {
        this._logger.info('[timer] %s', name);

        const id = uuidv4();

        const timerObj = setTimeout(() => {
            delete this._timers[id];
            this._triggerCallback(cb);
        }, timeoutMs);

        const timerInfo : TimerInfo = {
            id: id,
            name: name,
            isEnabled: true,
            handle: timerObj
        }

        this._timers[id] = timerInfo;

        return {
            close: () => {
                this._logger.info("[timer::close] %s, id: %s", name, id);
                const info = this._timers[id];
                if (info) {
                    info.isEnabled = false;
                    delete this._timers[id];
                    if (info.handle) {
                        clearTimeout(info.handle);
                        delete info.handle;
                    }
                }
            }
        }
    }

    interval(name: string, timeoutMs: number, cb: TimerFunction) : TimerObject
    {
        this._logger.info('[interval] %s', name);

        const id = uuidv4();

        const timerInfo : TimerInfo = {
            id: id,
            name: name,
            isEnabled: true
            // handle: timerObj
        }
        this._timers[id] = timerInfo;

        const scheduleTimer = () => {
            if (!timerInfo.isEnabled) {
                return;
            }

            timerInfo.handle = setTimeout(() => {
                this._triggerCallback(cb, () => {
                    scheduleTimer();
                });
            }, timeoutMs);
        };

        return {
            close: () => {
                this._logger.info("[interval::close] %s, id: %s", name, id);
                const info = this._timers[id];
                if (info) {
                    delete this._timers[id];
                    info.isEnabled = false;
                    if (info.handle) {
                        clearTimeout(info.handle);
                        delete info.handle;
                    }
                }
            }
        }
    }

    close()
    {
        this._logger.info('[close]');

        for(const id of _.keys(this._timers))
        {
            const info = this._timers[id];
            info.isEnabled = false;
            this._logger.info('[close] clearTimeout: %s', info.handle);
            if (info.handle) {
                clearTimeout(info.handle);
                delete info.handle;
            }
        }
        this._timers = {};
    }

    private _triggerCallback(cb: TimerFunction, onFinish? : () => void)
    {
        try
        {
            Promise.resolve(null)
                .then(() => cb())
                .catch(reason => {
                    this._logger.error("Failed in timer. ", reason);
                    return null;
                })
                .then(() => {
                    if (onFinish) {
                        onFinish();
                    }
                    return null;
                });
        }
        catch(reason)
        {
            this._logger.error("Failed in timer. ", reason);
            if (onFinish) {
                onFinish();
            }
        }
    }

   
}

interface TimerInfo
{
    id: string;
    name: string;
    isEnabled: boolean;
    handle?: NodeJS.Timeout;
}

export interface TimerObject
{
    close: () => void;
}