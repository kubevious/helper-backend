import { Context } from '../../context';
import { Router } from '../../../../src';

export default function (router: Router, context: Context) {
    router.url('/nested');

    router.get('/version', (req, res) => {
        return Promise.resolve(6789);
    });

}