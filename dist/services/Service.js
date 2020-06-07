"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = void 0;
const cluster_1 = require("cluster");
const util_1 = require("util");
class Service {
    constructor() {
        //@ts-ignore
        console.log = (str) => process.send({ op: "log", msg: str });
        //@ts-ignore
        console.debug = (str) => process.send({ op: "debug", msg: str });
        //@ts-ignore
        console.error = (str) => process.send({ op: "error", msg: str });
        //@ts-ignore
        console.warn = (str) => process.send({ op: "warn", msg: str });
        //Spawns
        process.on('uncaughtException', (err) => {
            //@ts-ignore
            process.send({ op: "error", msg: util_1.inspect(err) });
        });
        process.on('unhandledRejection', (reason, promise) => {
            //@ts-ignore
            process.send({ op: "error", msg: 'Unhandled Rejection at: ' + util_1.inspect(promise) + ' reason: ' + reason });
        });
        //@ts-ignore
        process.send({ op: "launched" });
        process.on("message", async (message) => {
            if (message.op) {
                switch (message.op) {
                    case "connect": {
                        this.path = message.path;
                        this.serviceName = message.serviceName;
                        this.timeout = message.timeout;
                        this.whatToLog = message.whatToLog;
                        this.loadCode();
                        break;
                    }
                    case "return": {
                        this.app.ipc.emit(message.id, message.value);
                        break;
                    }
                    case "command": {
                        if (this.app.handleCommand) {
                            const res = await this.app.handleCommand(message.command.msg);
                            if (message.command.receptive) {
                                //@ts-ignore
                                process.send({ op: "return", value: {
                                        id: message.command.UUID,
                                        value: res
                                    }, UUID: message.UUID });
                            }
                        }
                        else {
                            console.error(`Service ${this.serviceName} | I can't handle commands!`);
                        }
                        break;
                    }
                    case "shutdown": {
                        if (this.app.shutdown) {
                            let safe = false;
                            // Ask app to shutdown
                            this.app.shutdown(() => {
                                safe = true;
                                //@ts-ignore
                                process.send({ op: "shutdown" });
                            });
                            if (message.killTimeout > 0) {
                                setTimeout(() => {
                                    if (!safe) {
                                        console.error(`Service ${this.serviceName} took too long to shutdown. Performing shutdown anyway.`);
                                        //@ts-ignore
                                        process.send({ op: "shutdown" });
                                    }
                                    ;
                                }, message.killTimeout);
                            }
                        }
                        else {
                            //@ts-ignore
                            process.send({ op: "shutdown" });
                        }
                        break;
                    }
                }
            }
        });
    }
    async loadCode() {
        //@ts-ignore
        if (this.whatToLog.includes('service_start'))
            console.log(`Starting service ${this.serviceName}`);
        let App = (await Promise.resolve().then(() => __importStar(require(this.path))));
        if (App.ServiceWorker) {
            App = App.ServiceWorker;
        }
        else {
            App = App.default ? App.default : App;
        }
        this.app = new App({ serviceName: this.serviceName, workerID: cluster_1.worker.id });
        let ready = false;
        this.app.readyPromise.then(() => {
            //@ts-ignore
            if (this.whatToLog.includes('service_ready'))
                console.log(`Service ${this.serviceName} is ready!`);
            //@ts-ignore
            process.send({ op: "connected" });
            ready = true;
        }).catch((err) => {
            console.error(`Service ${this.serviceName} had an error starting: ${util_1.inspect(err)}`);
            process.kill(0);
        });
        // Timeout
        if (this.timeout !== 0) {
            setTimeout(() => {
                if (!ready) {
                    console.error(`Service ${this.serviceName} took too long to start.`);
                    process.kill(0);
                }
                ;
            }, this.timeout);
        }
        /* this.app.admiral.on("broadcast", (m) => {
            if (!m.event) console.error(`Service ${this.serviceName} | My emit cannot be completed since the message doesn't have a "message"!`);
            if (!m.msg) m.msg = null;
            //@ts-ignore
            process.send({op: "broadcast", event: {op: m.event, msg: m.msg}});
        }) */
    }
}
exports.Service = Service;
//# sourceMappingURL=Service.js.map