import 'mocha';
import should from 'should';

import _ from 'the-lodash';
import { MyPromise } from 'the-promise';

import { StopWatch } from '../src';

describe('stopwatch', function() {

    it('test-1', function() {
        const stopwatch = new StopWatch();
        return MyPromise.delay(200)
            .then(() => {
                const ms = stopwatch.stop();
                should(ms).not.be.above(400);
                should(ms).not.be.below(150);

                should(stopwatch.durationMs).be.equal(ms);
            })
    });

});