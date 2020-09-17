import { Context } from '../context';
import { Router } from '../../../src';
import { Promise } from 'the-promise';

export default function(router: Router, context: Context) {
    router.url("/do")

    router.middleware((req, res, next) => {

        console.log("I'm a special Middleware. URL:" + req.url);
        next();

    });

    router.get('/something', (req, res) => {
        return Promise.resolve(2222);
    })
}

export function checkUser(router: Router, context: Context) {
    router.url("/user")

    router.middleware('CHECK_USER');

    router.get('/login', (req, res) => {
        return Promise.resolve(2222);
    })
}

