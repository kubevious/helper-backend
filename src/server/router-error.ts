export class RouterError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        Object.setPrototypeOf(this, RouterError.prototype);
        // this.name = this.constructor.name;
        // Error.captureStackTrace(this, this.constructor);
        this.statusCode = statusCode;
    }
}
