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
    timeout: number;
    path: string;
};

interface ServiceConnectMessage {
    serviceName: string;
    path: string;
}

interface QueueItem {
    type: "service" | "cluster";
    workerID: number;
    message: ClusterConnectMessage | ServiceConnectMessage;
};

export class Queue extends EventEmitter {
    /** The queue */
    queue: QueueItem[];

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

    public item(item: QueueItem) {
        this.queue.push(item);
        if (this.queue.length == 0) this.execute(true);
    }
}