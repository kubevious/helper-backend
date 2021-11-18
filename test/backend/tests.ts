import 'mocha';
import should = require('should');
import { Backend } from '../../src';
import { Promise } from 'the-promise';
import { LogLevel } from 'the-logger';

describe('backend', () => {

    it('case-01', () => {
        const backend = new Backend('my-backend', { skipProcessExit: true });
        backend.logger.info('hello world case-01');
        backend.close();
    });

    it('sublogger-levels', () => {
        const backend = new Backend('my-backend', {
            skipProcessExit: true, 
            logLevels: {
                'sample': LogLevel.warn
            }
        });
        backend.logger.info('hello world sublogger-levels');
        const sampleLogger = backend.logger.sublogger('sample');

        backend.logger.info('hello world');

        sampleLogger.info('hello world')
        sampleLogger.warn('WWW hello world')
        sampleLogger.error('EEE hello world')

        backend.close();
    });


    it('timer', () => {
        const backend = new Backend('my-backend', { skipProcessExit: true });
        backend.logger.info('hello world');

        let count = 0;

        backend.timerScheduler.timer(100, () => {
            count++;
            return Promise.timeout(10);
        })

        return Promise.timeout(1050)
            .then(() => {
                should(count).be.equal(1);
            })
            .then(() => {
                backend.close();
            })
    });


    it('interval', () => {
        const backend = new Backend('my-backend', { skipProcessExit: true });
        backend.logger.info('hello world');

        let count = 0;

        backend.timerScheduler.interval(100, () => {
            console.log("[Interval] Triggered")
            count++;
            return Promise.timeout(10);
        })

        return Promise.timeout(1050)
            .then(() => {
                should(count).be.equal(10);
            })
            .then(() => {
                backend.close();
            })

    });

});
