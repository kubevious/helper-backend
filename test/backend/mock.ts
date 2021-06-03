import { Promise } from 'the-promise';
import { Backend } from '../../src';

const backend = new Backend('mock_BACKEND');
backend.logger.info('hello from mock');
backend.logger.silly('THIS is a silly message');

backend.stage("database", () => {
    backend.logger.info("Working on the database... please wait...")
    return Promise.resolve()
        .then(() => backend.logger.info("Database initialized"));
})

backend.stage("websocket", () => {
    backend.logger.info("Working on the websocket... please wait...")
    return Promise.resolve()
        .then(() => backend.logger.info("Websocket initialized"));
})

backend.run()
// backend.close();
