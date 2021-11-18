import 'mocha';
import should = require('should');

import _ from 'the-lodash';
import { Promise } from 'the-promise';

import { StopWatch } from '../src';

describe('stopwatch', function() {

    it('test-1', function() {
        const stopwatch = new StopWatch();
        return Promise.timeout(200)
            .then(() => {
                const ms = stopwatch.stop();
                should(ms).not.be.above(400);
                should(ms).not.be.below(150);

                should(stopwatch.durationMs).be.equal(ms);
            })
    });

});