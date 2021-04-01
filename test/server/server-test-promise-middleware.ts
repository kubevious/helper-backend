import 'mocha';
import should = require('should');
import { setupLogger, LoggerOptions } from 'the-logger';
import { Server } from '../../src';
import { Context } from './context';
import path from 'path';
import axios from 'axios';
import { RequestLocals } from './types';

const loggerOptions = new LoggerOptions().enableFile(false).pretty(true);
const logger = setupLogger('test', loggerOptions);

const PORT = 9999;
const BASE_URL = `http://localhost:${PORT}`;

let globalServer: Server<Context, any> | null;

describe('server-test-promise-middleware', () => {
    beforeEach(() => {
        let routersPath = path.join(__dirname, 'routers');
        globalServer = new Server(logger, new Context(), PORT, routersPath, {});

        globalServer.middlewareP<{}, RequestLocals>('CHECK_USER',
            (req, response) => {
                logger.info(">>>> I'm checking if the user is logged in.");
                response.locals.username = 'Chuck';
            }
        , {});

        globalServer.initializer((app) => {});

        return globalServer.run().then(() => {
            logger.info('Server created.');
        });
    });

    afterEach(() => {
        globalServer!.close();
        globalServer = null;
    });

    it('case-01', () => {
        return axios.get(`${BASE_URL}/version`).then((result) => {
            should(result.data).be.equal(1234);
        });
    });

    it('case-02', () => {
        return axios.get(`${BASE_URL}/name`).then((result) => {
            should(result.data).be.equal('foo-bar');
        });
    });

    it('body-validation-pass', () => {
        return axios.post(`${BASE_URL}/bar`, { foo: 'bar', age: 1234 }).then((result) => {
            should(result).be.ok();
            should(result.data).be.equal(8888);
        });
    });

    it('body-validation-fail', () => {
        let errorReceived: any;
        return axios
            .post(`${BASE_URL}/bar`, { xx: '1234' })
            .catch((reason) => {
                errorReceived = reason;
            })
            .then(() => {
                should(errorReceived).be.ok();
                should(errorReceived.response.status).be.equal(400);
            });
    });

    it('five-hindred-error', () => {
        let errorReceived: any;
        return axios
            .delete(`${BASE_URL}/error/five-hundred`)
            .catch((reason) => {
                errorReceived = reason;
            })
            .then(() => {
                should(errorReceived).be.ok();
                should(errorReceived.response.status).be.equal(500);
            });
    });

    it('report-error-api', () => {
        let errorReceived: any;
        return axios
            .options(`${BASE_URL}/error/another-error`)
            .catch((reason) => {
                errorReceived = reason;
            })
            .then(() => {
                should(errorReceived).be.ok();
                should(errorReceived.response.status).be.equal(403);
            });
    });

    it('middleware-01', () => {
        return axios.get(`${BASE_URL}/do/something`).then((result) => {
            should(result.data).be.equal(2222);
        });
    });

    it('middleware-02', () => {
        return axios.get(`${BASE_URL}/user/login`).then((result) => {
            should(result.data).be.equal('Chuck');
        });
    });
});
