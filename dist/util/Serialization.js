"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJSON = exports.stringifyJSON = exports.errorToJSON = exports.reconstructError = void 0;
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
const stringifyJSON = (data) => {
    return JSON.stringify(data, (key, value) => {
        switch (typeof value) {
            case "bigint": {
                return `BIGINT::${value}`;
            }
            case "undefined": {
                return "UNDEFINED::";
            }
            default: {
                return value;
            }
        }
    });
};
exports.stringifyJSON = stringifyJSON;
const parseJSON = (json) => {
    return JSON.parse(json, (key, value) => {
        if (typeof value === "string") {
            if (value.startsWith("BIGINT::")) {
                return BigInt(value.substring(8));
            }
            else if (value.startsWith("UNDEFINED::")) {
                return undefined;
            }
        }
        return value;
    });
};
exports.parseJSON = parseJSON;
//# sourceMappingURL=Serialization.js.map