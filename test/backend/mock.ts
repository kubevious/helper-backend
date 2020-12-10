import { Backend } from '../../src';

const backend = new Backend('mock-backend');
backend.logger.info('hello from mock');
backend.initialize(() => {
    
})
// backend.close();
