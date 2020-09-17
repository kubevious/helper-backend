import 'mocha';
import should = require('should');
import { setupLogger, LoggerOptions } from 'the-logger';
import { Server } from '../../src';
import { Context } from './context';
import path from 'path';
import {Promise} from 'the-promise';
import axios from 'axios';

const loggerOptions = new LoggerOptions()
    .enableFile(false)
    .pretty(true);
const logger = setupLogger('test', loggerOptions);

const PORT = 9999;

let globalServer : Server<Context>;

function makeServer() : Server<Context>
{
    let routersPath = path.join(__dirname, 'routers');
    let server = new Server(logger, new Context(), PORT, routersPath);
    server.run();
    return server;
}

describe('server', () => {

    beforeEach(() => {
        globalServer = makeServer();
    });
    
    afterEach(() => {
        globalServer.close();
    });

    it('case-01', () => {
        return Promise.timeout(100)
            .then(() => {
                return axios.get(`http://localhost:${PORT}/version`);
            })
            .then(result => {
                should(result.data).be.equal(1234);
            })
    });

    it('body-validation-pass', () => {
        return Promise.timeout(100)
            .then(() => {
                return axios.post(`http://localhost:${PORT}/bar`, { foo: 'bar', age: 1234 });
            })
            .then(result => {
                should(result).be.ok();
                should(result.data).be.equal(8888);
            })
    });

    it('body-validation-fail', () => {
        let errorReceived : any;
        return Promise.timeout(100)
            .then(() => {
                return axios.post(`http://localhost:${PORT}/bar`, { xx: '1234' });
            })
            .catch(reason => {
                errorReceived = reason;
            })
            .then(() => {
                should(errorReceived).be.ok();
                should(errorReceived.response.status).be.equal(400);
            })
    });

});
