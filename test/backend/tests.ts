import 'mocha';
import should = require('should');
import { Backend } from '../../src';
import { Promise } from 'the-promise';
import { LogLevel } from 'the-logger';

describe('backend', () => {
    it('case-01', () => {
        const backend = new Backend('my-backend');
        backend.logger.info('hello world');
        backend.close();
    });

    it('sublogger-levels', () => {
        const backend = new Backend('my-backend', {
            logLevels: {
                'sample': LogLevel.warn
            }
        });
        backend.logger.info('hello world');
        let sampleLogger = backend.logger.sublogger('sample');

        backend.logger.info('hello world');

        sampleLogger.info('hello world')
        sampleLogger.warn('WWW hello world')
        sampleLogger.error('EEE hello world')

        backend.close();
    });


    it('timer', () => {
        const backend = new Backend('my-backend');
        backend.logger.info('hello world');

        let count = 0;

        backend.timer(100, () => {
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
        const backend = new Backend('my-backend');
        backend.logger.info('hello world');

        let count = 0;

        backend.interval(100, () => {
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
