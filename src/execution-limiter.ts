import _ from 'the-lodash';
import { ILogger } from 'the-logger' ;
import { StopWatch } from './stopwatch';

export class ExecutionLimiter
{
    private _logger : ILogger;

    constructor(logger : ILogger)
    {
        this._logger = logger.sublogger('ExecutionLimiter');
        this._logger.info('[constructor]');
    }

    create()
    {
        const item = new ExecutionLimiterItem();
        return item;
    }
}

export class ExecutionLimiterItem
{
    private _totalCount = 0;
    private _stopwatch : StopWatch = new StopWatch();

    addItems(count: number) {
        this._totalCount += count;

        return this.shouldStop();
    }

    shouldStop() : boolean
    {
        if (this._stopwatch.durationMs >= 5 * 1000) {
            return true;
        }
        if (this._totalCount >= 1000) {
            return true;
        }
        return false;
    }
}