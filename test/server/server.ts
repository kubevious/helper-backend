import 'mocha';
import should = require('should');
import { setupLogger, LoggerOptions } from 'the-logger';
import { Server } from '../../src/server';
import { Context } from './context';
import path from 'path';
import {Promise} from 'the-promise';
import axios from 'axios';

const loggerOptions = new LoggerOptions()
    .enableFile(false)
    .pretty(true);
const logger = setupLogger('test', loggerOptions);

const PORT = 9999;

describe('server', () => {

    it('constructor', () => {
        let routersPath = path.join(__dirname, 'routers');
        let server = new Server(logger, new Context(), PORT, routersPath);
        server.run();

        return Promise.timeout(100)
            .then(() => {
                return axios.get(`http://localhost:${PORT}/version`);
            })
            .then(result => {
                should(result.data).be.equal(1234);
            })
            .then(() => {
                return server.close();
            })
    });

});
