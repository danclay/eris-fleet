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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = void 0;
const cluster_1 = require("cluster");
const util_1 = require("util");
const IPC_1 = require("../util/IPC");
class Service {
    constructor(input) {
        this.ipc = new IPC_1.IPC({ fetchTimeout: input.fetchTimeout });
        if (input.overrideConsole) {
            console.log = (str) => { this.ipc.log(str); };
            console.debug = (str) => { this.ipc.debug(str); };
            console.error = (str) => { this.ipc.error(str); };
            console.warn = (str) => { this.ipc.warn(str); };
        }
        // Spawns
        process.on("uncaughtException", (err) => {
            this.ipc.error(err);
        });
        process.on("unhandledRejection", (reason, promise) => {
            this.ipc.error("Unhandled Rejection at: " + util_1.inspect(promise) + " reason: " + reason);
        });
        if (process.send)
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
                        if (this.app)
                            this.ipc.emit(message.id, message.value);
                        break;
                    }
                    case "command": {
                        const noHandle = () => {
                            const res = { err: `Service ${this.serviceName} cannot handle commands!` };
                            if (process.send)
                                process.send({ op: "return", value: {
                                        id: message.command.UUID,
                                        value: res,
                                        serviceName: this.serviceName
                                    }, UUID: message.UUID });
                            this.ipc.error("I can't handle commands!");
                        };
                        if (this.app) {
                            if (this.app.handleCommand) {
                                const res = await this.app.handleCommand(message.command.msg);
                                if (message.command.receptive) {
                                    if (process.send)
                                        process.send({ op: "return", value: {
                                                id: message.command.UUID,
                                                value: res,
                                                serviceName: this.serviceName
                                            }, UUID: message.UUID });
                                }
                            }
                            else {
                                noHandle();
                            }
                        }
                        else {
                            noHandle();
                        }
                        break;
                    }
                    case "eval": {
                        const errorEncountered = (err) => {
                            if (message.request.receptive) {
                                if (process.send)
                                    process.send({ op: "return", value: {
                                            id: message.request.UUID,
                                            value: { err },
                                            serviceName: this.serviceName
                                        }, UUID: message.UUID });
                            }
                        };
                        if (this.app) {
                            this.app.runEval(message.request.stringToEvaluate)
                                .then((res) => {
                                if (message.request.receptive) {
                                    if (process.send)
                                        process.send({ op: "return", value: {
                                                id: message.request.UUID,
                                                value: res,
                                                serviceName: this.serviceName
                                            }, UUID: message.UUID });
                                }
                            }).catch((error) => {
                                errorEncountered(error);
                            });
                        }
                        else {
                            errorEncountered("Cluster is not ready!");
                        }
                        break;
                    }
                    case "shutdown": {
                        if (this.app) {
                            if (this.app.shutdown) {
                                // Ask app to shutdown
                                this.app.shutdown(() => {
                                    if (process.send)
                                        process.send({ op: "shutdown" });
                                });
                            }
                            else {
                                if (process.send)
                                    process.send({ op: "shutdown" });
                            }
                        }
                        else {
                            if (process.send)
                                process.send({ op: "shutdown" });
                        }
                        break;
                    }
                    case "collectStats": {
                        if (process.send)
                            process.send({ op: "collectStats", stats: {
                                    uptime: this.connectedTimestamp ? new Date().getTime() - this.connectedTimestamp : 0,
                                    ram: process.memoryUsage().rss / 1e6,
                                    ipcLatency: new Date().getTime()
                                } });
                        break;
                    }
                }
            }
        });
    }
    async loadCode() {
        if (this.app)
            return;
        if (this.whatToLog.includes("service_start"))
            this.ipc.log(`Starting service ${this.serviceName}`);
        let App = (await Promise.resolve().then(() => __importStar(require(this.path))));
        if (App.ServiceWorker) {
            App = App.ServiceWorker;
        }
        else {
            App = App.default ? App.default : App;
        }
        this.app = new App({ serviceName: this.serviceName, workerID: cluster_1.worker.id, ipc: this.ipc });
        let ready = false;
        if (this.app)
            this.app.readyPromise.then(() => {
                if (this.whatToLog.includes("service_ready"))
                    this.ipc.log(`Service ${this.serviceName} is ready!`);
                if (process.send)
                    process.send({ op: "connected" });
                ready = true;
                this.connectedTimestamp = new Date().getTime();
            }).catch((err) => {
                this.ipc.error(`Service ${this.serviceName} had an error starting: ${util_1.inspect(err)}`);
                process.kill(0);
            });
        // Timeout
        if (this.timeout !== 0) {
            setTimeout(() => {
                if (!ready) {
                    this.ipc.error(`Service ${this.serviceName} took too long to start.`);
                    process.kill(0);
                }
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