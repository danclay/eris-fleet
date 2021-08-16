"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorToJSON = exports.reconstructError = void 0;
const errorToJSON = (error) => {
    return {
        code: error.code,
        errno: error.errno,
        message: error.message,
        name: error.name,
        path: error.path,
        stack: error.stack,
        syscall: error.syscall
    };
};
exports.errorToJSON = errorToJSON;
const reconstructError = (data) => {
    if (!(data instanceof Error))
        return data;
    const objData = data;
    const result = new Error();
    Object.entries(objData).forEach(([key, value]) => {
        result[key] = value;
    });
    return result;
};
exports.reconstructError = reconstructError;
//# sourceMappingURL=ErrorHandler.js.map