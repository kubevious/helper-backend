import 'mocha';
import should = require('should');
import { Backend } from '../../src';

describe('backend', () => {
    it('case-01', () => {
        const backend = new Backend('my-backend');
        backend.logger.info('hello world');
        backend.close();
    });
});
