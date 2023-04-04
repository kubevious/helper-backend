import 'mocha';
import should from 'should';

import _ from 'the-lodash';
import { MyPromise } from 'the-promise';
import { setupLogger, LoggerOptions } from 'the-logger';

const loggerOptions = new LoggerOptions().enableFile(false).pretty(true);
const logger = setupLogger('test', loggerOptions);

import { ProcessingTracker, TimerScheduler } from '../src';

describe('processing-tracker', function() {

    it('test-1', function() {
        const scheduler = new TimerScheduler(logger.sublogger("Scheduler"));
        const processingTracker = new ProcessingTracker(logger, scheduler);

        return processingTracker.scope("doSomething", () => {
            return MyPromise.delay(200);
        })
        .then(() => {
            {
                const task = processingTracker.getTaskInfo("doSomething");
                should(task.failed).be.false();
                (task.duration).should.be.below(400);
                (task.duration).should.be.above(150);
            }

            processingTracker.debugOutput();
        })
        .then(() => {
            processingTracker.close();
        })
    });

    it('test-2', function() {
        const scheduler = new TimerScheduler(logger.sublogger("Scheduler"));
        const processingTracker = new ProcessingTracker(logger, scheduler);

        return processingTracker.scope("doSomething", (doSomethingScope) => {
            return MyPromise.delay(100)
                .then(() => doSomethingScope.scope("another", () => {
                    return MyPromise.delay(300);
                }));
        })
        .then(() => {
            {
                const task = processingTracker.getTaskInfo("doSomething");
                should(task.failed).not.be.true();
                (task.duration).should.be.below(700);
                (task.duration).should.be.above(350);
            }

            {
                const task = processingTracker.getTaskInfo("doSomething/another");
                should(task.failed).not.be.true();
                (task.duration).should.be.below(400);
                (task.duration).should.be.above(250);
            }

            processingTracker.debugOutput();
        })
        .then(() => {
            processingTracker.close();
        })
    });


    it('test-3', function() {
        const scheduler = new TimerScheduler(logger.sublogger("Scheduler"));
        const processingTracker = new ProcessingTracker(logger, scheduler);

        return processingTracker.scope("doSomething", () => {
            return MyPromise.delay(100)
                .then(() => { throw new Error("FAILED!!!") })
        })
        .then(() => {
            should.fail("SHOULD HAVE BEEN FAILED", "")
        })
        .catch(reason => {
            {
                const task = processingTracker.getTaskInfo("doSomething");
                (task.failed).should.be.true();
                (task.duration).should.not.be.above(300);
                (task.duration).should.not.be.below(50);
            }
        })
        .then(() => {
            processingTracker.debugOutput();
        })
        .then(() => {
            processingTracker.close();
        })
    });

    it('test-4', function() {
        const scheduler = new TimerScheduler(logger.sublogger("Scheduler"));
        const processingTracker = new ProcessingTracker(logger, scheduler);

        return processingTracker.scope("doSomething", () => {
            return MyPromise.delay(100)
                .then(() => 1234)
        })
        .then(result => { 
            (result).should.be.equal(1234);
        })
        .then(() => {
            processingTracker.debugOutput();
        })
        .then(() => {
            const data = processingTracker.extract();
            logger.info('EXTRACTED DATA', data);
        })
        .then(() => {
            processingTracker.close();
        })
    });


    it('test-5', function() {
        const scheduler = new TimerScheduler(logger.sublogger("Scheduler"));
        const processingTracker = new ProcessingTracker(logger, scheduler);

        let myExtractedData : any;

        processingTracker.registerListener(extractedData => {
            myExtractedData = extractedData;
            
        })

        return processingTracker.scope("doSomething", (childTracker) => {

            return MyPromise.serial([1, 2, 3, 4], x => {
                return childTracker.scope("ITEM-" + x, () => {
                    return MyPromise.delay(100)
                        .then(() => x + 1);
                })
            })
        })
        .then(result => { 
            (result).should.be.eql([2, 3, 4, 5]);
        })
        .then(() => {
            processingTracker.debugOutput();
        })
        .then(() => {
            // logger.info('EXTRACTED DATA', myExtractedData);
            should(myExtractedData).be.an.Array();
        })
        .then(() => {
            processingTracker.close();
        })
    });

    it('test-5', function() {
        const scheduler = new TimerScheduler(logger.sublogger("Scheduler"));
        const processingTracker = new ProcessingTracker(logger, scheduler);

        return MyPromise.serial([1, 2, 3, 4, 5, 6, 7, 8], x => {
            return processingTracker.scope("doSomething", (childTracker) => {
                return MyPromise.delay(x * 10);
            });
        })
        .then(() => {
            processingTracker.debugOutput();
        })
        .then(() => {
            const data = processingTracker.extract();
            // logger.info('EXTRACTED DATA', data);
            should(data).be.an.Array();
            for(const x of data)
            {
                should(x).be.an.Object();
                should(x.name).be.equal("doSomething")
                should(x.results).be.an.Array();
                for(const r of x.results)
                {
                    should(r.duration).be.a.Number();
                    should(r.failed).be.false();
                }
            }
        })
        .then(() => {
            processingTracker.close();
        })
    });


    it('test-debug-output', function() {
        const scheduler = new TimerScheduler(logger.sublogger("Scheduler"));
        const processingTracker = new ProcessingTracker(logger, scheduler);

        processingTracker.enablePeriodicDebugOutput(1);
        processingTracker.disablePeriodicDebugOutput();

        processingTracker.close();
    });
});