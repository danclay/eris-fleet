import {worker} from 'cluster';
import {BaseServiceWorker} from './BaseServiceWorker';
import {inspect} from 'util';

export class Service {
    path!: string;
    serviceName!: string;
    app!: BaseServiceWorker;
    timeout!: number;
    whatToLog!: string[];

    constructor() {

        //@ts-ignore
        console.log = (str: any) => process.send({op: "log", msg: str});
        //@ts-ignore
        console.debug = (str: any) => process.send({op: "debug", msg: str});
        //@ts-ignore
        console.error = (str: any) => process.send({op: "error", msg: str});
        //@ts-ignore
        console.warn = (str: any) => process.send({op: "warn", msg: str});

        //Spawns
        process.on('uncaughtException', (err: Error) => {
            //@ts-ignore
            process.send({op: "error", msg: inspect(err)});
        });

        process.on('unhandledRejection', (reason, promise) => {
            //@ts-ignore
            process.send({op: "error", msg: 'Unhandled Rejection at: ' + inspect(promise) + ' reason: ' + reason});
        });

        //@ts-ignore
        process.send({op: "launched"});

        process.on("message", async message => {
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
                                process.send({op: "return", value: {
                                    id: message.command.UUID,
                                    value: res
                                }, UUID: message.UUID});
                            }
                        } else {
                            const res = {err: `Service ${this.serviceName} cannot handle commands!`};
                            //@ts-ignore
                            process.send({op: "return", value: {
                                id: message.command.UUID,
                                value: res
                            }, UUID: message.UUID});
                            console.error(`I can't handle commands!`);
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
                                process.send({op: "shutdown"});
                            });
                            if (message.killTimeout > 0) {
                                setTimeout(() => {
                                    if (!safe) {
                                        console.error(`Service ${this.serviceName} took too long to shutdown. Performing shutdown anyway.`);
                                        
                                        //@ts-ignore
                                        process.send({op: "shutdown"});
                                    };
                                }, message.killTimeout);
                            }
                        } else {
                            //@ts-ignore
                            process.send({op: "shutdown"});
                        }

                        break;
                    }
                    case "collectStats": {
                        //@ts-ignore
                        process.send({op: "collectStats", stats: {
                            ram: process.memoryUsage().rss / 1e6
                        }});

                        break;
                    }
                }
            }
        });
    }
 
    private async loadCode() {
        //@ts-ignore
        if (this.whatToLog.includes('service_start')) console.log(`Starting service ${this.serviceName}`);

        let App = (await import(this.path));
        if (App.ServiceWorker) {
            App = App.ServiceWorker;
        } else {
            App = App.default ? App.default : App;
        }
        this.app = new App({serviceName: this.serviceName, workerID: worker.id});

        let ready = false;
        this.app.readyPromise.then(() => {
            //@ts-ignore
            if (this.whatToLog.includes('service_ready')) console.log(`Service ${this.serviceName} is ready!`);
            //@ts-ignore
            process.send({op: "connected"});
            ready = true;
        }).catch((err: any) => {
            console.error(`Service ${this.serviceName} had an error starting: ${inspect(err)}`);
            process.kill(0);
        });

        // Timeout
        if (this.timeout !== 0) {
            setTimeout(() => {
                if (!ready) {
                    console.error(`Service ${this.serviceName} took too long to start.`);
                    process.kill(0);
                };
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