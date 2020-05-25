import {worker} from 'cluster';
import {BaseServiceWorker} from './BaseServiceWorker';
import {inspect} from 'util';

export class Service {
    path!: string;
    serviceName!: string;
    app!: BaseServiceWorker;
    timeout!: number;

    constructor() {
        //@ts-ignore
        console.log = (str: any) => process.send({op: "log", msg: str});
        //@ts-ignore
        console.debug = (str: any) => process.send({op: "debug", msg: str});
        //@ts-ignore
        console.error = (str: any) => process.send({op: "error", msg: str});

        //Spawns
        process.on('uncaughtException', (err: Error) => {
            //@ts-ignore
            process.send({op: "error", msg: inspect(err)});
        });

        process.on('unhandledRejection', (reason, promise) => {
            //@ts-ignore
            process.send({op: "error", msg: 'Unhandled Rejection at: ' + inspect(promise) + ' reason: ' + reason});
        });

        process.on("message", async message => {
            if (message.op) {
                switch (message.op) {
                    case "connect": {
                        this.path = message.path;
                        this.serviceName = message.serviceName;
                        this.timeout = message.timeout;
                        this.loadCode();
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
                            console.error(`Service ${this.serviceName} | I can't handle commands!`);
                        }
                    }
                }
            }
        });
    }
 
    private async loadCode() {
        //@ts-ignore
        process.send({op: "log", msg: `Starting service ${this.serviceName}`});

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
            process.send({op: "log", msg: `Service ${this.serviceName} is ready!`});
            //@ts-ignore
            process.send({op: "connected"});
            ready = true;
        });

        // Timeout
        if (this.timeout !== 0) {
            setTimeout(() => {
                if (!ready) {
                    console.error(`Service ${this.serviceName} took too long to start.`);
                    process.exit(1);
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