interface SentError {
    message: string;
    stack?: string;
    name: string;
    code?: string;
}
declare const reconstructError: (data: unknown) => unknown;
export { reconstructError, SentError };
