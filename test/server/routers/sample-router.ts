import { Context } from '../context';
import { Router } from '../../../src';
import { Promise } from 'the-promise';

import Joi from 'joi';

export default function (router: Router, context: Context) {
    router.url('/');

    router.get('/version', (req, res) => {
        return Promise.resolve(1234);
    });

    router.get('/name', (req, res) => {
        return context.name;
    });
}

export function router2(router: Router) {
    router.url('/');

    router
        .post('/bar', (req, res) => {
            return Promise.resolve(8888);
        })
        .bodySchema(
            Joi.object({
                foo: Joi.string(),
                age: Joi.number(),
            }),
        );
}

export function router3(router: Router, context: Context) {
    router.url('/error');

    router.delete('/five-hundred', (req, res) => {
        throw new Error('I am failing');
    });

    router.options('/another-error', (req, res) => {
        router.reportError(403, 'abcd');
    });
}
