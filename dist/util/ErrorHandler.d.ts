/// <reference types="node" />
interface SentError {
    message: string;
    stack?: string;
    name: string;
    code?: string;
}
declare const errorToJSON: (error: NodeJS.ErrnoException) => NodeJS.ErrnoException;
declare const reconstructError: (data: NodeJS.ErrnoException) => NodeJS.ErrnoException;
export { reconstructError, errorToJSON, SentError };
