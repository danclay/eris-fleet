"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CentralRequestHandler = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ErrorHandler_1 = require("./ErrorHandler");
class CentralRequestHandler {
    constructor(ipc, options) {
        this.timeout = options.timeout;
        this.ipc = ipc;
        this.requests = new Map();
        process.on("message", message => {
            if (message.op === "centralApiResponse") {
                const request = this.requests.get(message.id);
                if (request) {
                    request(message.value);
                }
            }
        });
    }
    request(method, url, auth, body, file, _route, short) {
        const UUID = crypto_1.default.randomBytes(16).toString("hex");
        let fileString;
        if (file) {
            if (file.file) {
                fileString = Buffer.from(file.file).toString("base64");
                file.file = "";
            }
        }
        const data = { method, url, auth, body, file, fileString, _route, short };
        if (process.send)
            process.send({ op: "centralApiRequest", request: { UUID, data } });
        return new Promise((resolve, reject) => {
            // timeout
            const timeout = setTimeout(() => {
                this.requests.delete(UUID);
                reject(`Request timed out (>${this.timeout}ms)`);
            }, this.timeout);
            const callback = (r) => {
                this.requests.delete(UUID);
                clearTimeout(timeout);
                if (r.resolved) {
                    resolve(r.value);
                }
                else {
                    const value = r.value;
                    if (value.convertedErrorObject) {
                        reject((0, ErrorHandler_1.reconstructError)(value.error));
                    }
                    else {
                        reject(value.error);
                    }
                }
            };
            this.requests.set(UUID, callback);
        });
    }
}
exports.CentralRequestHandler = CentralRequestHandler;
//# sourceMappingURL=CentralRequestHandler.js.map