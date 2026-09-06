export interface Log {
    app?: string;
    env?: string;
    data?: object;
    stack?: string;
    requestId?: string;
    message?: string;
    logId?: string;
}