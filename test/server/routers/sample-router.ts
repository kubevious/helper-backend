import { Context } from '../context';
import { RouterBuilder } from '../../../src/server';
import { Promise } from 'the-promise';

export function router(builder: RouterBuilder<Context>) {
    builder
        .url("/")
        .get('/version', (req, res) => {
            return Promise.resolve(1234);
        });
}