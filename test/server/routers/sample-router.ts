import { Context } from '../context';
import { RouterWrapper } from '../../../src';
import { Promise } from 'the-promise';

import Joi from 'joi';

export default function(router: RouterWrapper<Context>) {
    router.url("/")

    router.get('/version', (req, res) => {
        return Promise.resolve(1234);
    })
}


export function router2(router: RouterWrapper<Context>) {
    router.url("/")

    router.post('/bar', (req, res) => {
            return Promise.resolve(8888);
        })
        .bodySchema(
            Joi.object({
                foo: Joi.string(),
                age: Joi.number()
            })
        )
        ;
}