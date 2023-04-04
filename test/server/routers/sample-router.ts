import { Context } from '../context';
import { Router } from '../../../src';

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


export function router4(router: Router, context: Context) {
    router.url('/router4');

    router.get<any, any, Company, User>('/foo', (req, res) => {
        // req.query.address
        // res.locals.name
    })
    ;

}

export interface User
{
    name: string,
    phone: string
}


export interface Company
{
    address: string,
    symbol: string
}