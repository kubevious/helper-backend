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
export class ErrorReporter 
{
    reportError(statusCode: number, message: string): void {
        throw new RouterError(message, statusCode);
    }

    reportUserError(message: string): void {
        throw new RouterError(message, 400);
    }
}
