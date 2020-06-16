import {EventEmitter} from 'events';

export class IPC extends EventEmitter {
    private events: Map<string | number, {fn: Function}>;

    public constructor() {
        super();
        this.events = new Map();

        process.on('message', msg => {
            const event = this.events.get(msg.op);
            if (event) {
                event.fn(msg);
            }
        });
    }

    public register(event: string, callback: Function) {
        if (this.events.get(event)) {
            //@ts-ignore
            process.send({op: "error", msg: "IPC | Can't register 2 events with the same name."});
        } else {
            this.events.set(event, {fn: callback});
        }
    }

    public unregister(event:string) {
        this.events.delete(event);
    }

    public broadcast(op: string, message?: any) {
        if (!message) message = null;
        //@ts-ignore
        process.send({op: "broadcast", event: {op, msg: message}});
    }

    public sendTo(cluster: number, op: string, message?: any) {
        if (!message) message = null;
        //@ts-ignore
        process.send({op: "sendTo", cluster: cluster, event: {msg: message, op}});
    }

    public async fetchUser(id: number) {
        //@ts-ignore
        process.send({op: "fetchUser", id});

        return new Promise((resolve, reject) => {
            const callback = (r: any) => {
                //@ts-ignore
                this.removeListener(id,  callback);
                resolve(r);
            };

            //@ts-ignore
            this.on(id, callback);
        })
    }

    public async fetchGuild(id: number) {
        //@ts-ignore
        process.send({op: "fetchGuild", id});

        return new Promise((resolve, reject) => {
            const callback = (r: any) => {
                //@ts-ignore
                this.removeListener(id,  callback);
                resolve(r);
            };

            //@ts-ignore
            this.on(id, callback);
        })
    }

    public async fetchChannel(id: number) {
        //@ts-ignore
        process.send({op: "fetchChannel", id});

        return new Promise((resolve, reject) => {
            const callback = (r: any) => {
                //@ts-ignore
                this.removeListener(id,  callback);
                resolve(r);
            };

            //@ts-ignore
            this.on(id, callback);
        })
    }

    public async fetchMember(guildID: number, memberID: number) {
        const UUID = {memberID, guildID};
        //@ts-ignore
        process.send({op: "fetchMember", guildID, memberID});

        return new Promise((resolve, reject) => {
            const callback = (r: any) => {
                //@ts-ignore
                this.removeListener(String(UUID),  callback);
                resolve(r);
            };

            //@ts-ignore
            this.on(String(UUID), callback);
        })
    }

    public async command(service: string, message?: any, receptive?: Boolean) {
        if (!message) message = null;
        if (!receptive) receptive = false;
        const UUID = JSON.stringify({timestamp: Date.now(), message, service, receptive});
        //@ts-ignore
        process.send({op: "serviceCommand", 
            command: {
                service,
                msg: message,
                UUID,
                receptive
            }
        });

        if (receptive) {
            return new Promise((resolve, reject) => {
                const callback = (r: any) => {
                    //@ts-ignore
                    this.removeListener(UUID, callback);
                    if (r.value.err) {
                        reject(r.value.err);
                    } else {
                    resolve(r.value);
                    }
                };
    
                this.on(UUID, callback);
            })
        }
    }

    public async getStats() {
        //@ts-ignore
        process.send({op: "getStats"});

        return new Promise((resolve, reject) => {
            const callback = (r: any) => {
                //@ts-ignore
                this.removeListener("statsReturn",  callback);
                resolve(r);
            };

            //@ts-ignore
            this.on("statsReturn", callback);
        })
    }

    public restartCluster(clusterID: number, hard?: Boolean) {
        //@ts-ignore
        process.send({op: "restartCluster", clusterID, hard: hard ? true : false});
    }

    public restartAllClusters(hard?: Boolean) {
        //@ts-ignore
        process.send({op: "restartAllClusters", hard: hard ? true : false});
    }

    public restartService(serviceName: string, hard?: Boolean) {
        //@ts-ignore
        process.send({op: "restartService", serviceName, hard: hard ? true : false});
    }

    public restartAllServices(hard?: Boolean) {
        //@ts-ignore
        process.send({op: "restartAllServices", hard: hard ? true : false});
    }

    public shutdownCluster(clusterID: number, hard?: Boolean) {
        //@ts-ignore
        process.send({op: "shutdownCluster", clusterID, hard: hard ? true : false});
    }

    public shutdownService(serviceName: string, hard?: Boolean) {
        //@ts-ignore
        process.send({op: "shutdownService", serviceName, hard: hard ? true : false});
    }

    /** Total shutdown of fleet */
    public totalShutdown(hard?: Boolean) {
        //@ts-ignore
        process.send({op: "totalShutdown", hard: hard ? true : false});
    }

    public reshard() {
        //@ts-ignore
        process.send({op: "reshard"});
    }
 }