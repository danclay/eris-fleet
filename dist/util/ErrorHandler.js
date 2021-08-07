"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconstructError = void 0;
const reconstructError = (data) => {
    if (!(typeof data === "object") || data === null)
        return data;
    const objData = data;
    const result = new Error();
    result.message = objData.message;
    result.stack = objData.stack;
    result.name = objData.name;
    result.code = objData.code;
    return result;
};
exports.reconstructError = reconstructError;
//# sourceMappingURL=ErrorHandler.js.map