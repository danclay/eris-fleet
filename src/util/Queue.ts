import {EventEmitter} from 'events';
import {ClientOptions} from 'eris';

interface ClusterConnectMessage {
    clusterID: number;
    clusterCount: number;
    op: "connect";
    firstShardID: number;
    lastShardID: number;
    shardCount: number;
    token: string;
    clientOptions: ClientOptions;
    path: string;
    whatToLog: string[];
};

interface ServiceConnectMessage {
    serviceName: string;
    path: string;
    op: "connect";
    timeout: number;
    whatToLog: string[];
}

export interface QueueItem {
    type: "service" | "cluster";
    workerID: number;
    message: ClusterConnectMessage | ServiceConnectMessage;
};

export class Queue extends EventEmitter {
    /** The queue */
    public queue: QueueItem[];

    public constructor() {
        super();
        this.queue = [];
    }

    public execute(first?: Boolean) {
        if (!first) this.queue.splice(0, 1);
        const item = this.queue[0];
        if (!item) return;
        this.emit("execute", item);
    }

    public item(item: QueueItem, overrideLocation?: number) {
        this.queue.push(item);
        if (this.queue.length == 1) this.execute(true);
    }
}