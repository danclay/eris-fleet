/// <reference types="node" />
import { EventEmitter } from "events";
import { ClusterCollection, ServiceCollection, Stats, ReshardOptions } from "../sharding/Admiral";
import { Collection } from "../util/Collection";
export interface IpcHandledLog {
    op: "log" | "info" | "error" | "warn" | "debug";
    ipcLogObject: boolean;
    msg: unknown;
    source?: string;
    valueTranslatedFrom?: "Error";
    valueTypeof: string;
    timestamp: number;
}
export interface Setup {
    fetchTimeout: number;
    messageHandler?: (message: any) => void;
}
export declare class CentralStore {
    private ipc;
    constructor(ipc: IPC);
    copyMap(): Promise<Map<string, any>>;
    clear(): Promise<undefined>;
    delete(key: string): Promise<boolean>;
    get(key: string): Promise<any>;
    has(key: string): Promise<boolean>;
    set(key: string, value: unknown): Promise<void>;
}
export declare class IPC extends EventEmitter {
    private events;
    private ipcEventListeners;
    private fetchTimeout;
    private messageHandler?;
    centralStore: CentralStore;
    constructor(setup: Setup);
    sendMessage(message: unknown): void;
    private sendLog;
    log(message: unknown, source?: string): void;
    info(message: unknown, source?: string): void;
    error(message: unknown, source?: string): void;
    warn(message: unknown, source?: string): void;
    debug(message: unknown, source?: string): void;
    register(event: string, callback: (msg: any) => void): void;
    unregister(event: string, callback?: (msg: any) => void): void;
    broadcast(op: string, message?: unknown): void;
    sendToAdmiral(op: string, message?: unknown): void;
    admiralBroadcast(op: string, message?: unknown): void;
    sendTo(cluster: number, op: string, message?: unknown): void;
    fetchUser(id: string): Promise<any>;
    fetchGuild(id: string): Promise<any>;
    fetchChannel(id: string): Promise<any>;
    fetchMember(guildID: string, memberID: string): Promise<any>;
    command(service: string, message?: unknown, receptive?: boolean, returnTimeout?: number): Promise<any> | void;
    serviceCommand(service: string, message?: unknown, receptive?: boolean, returnTimeout?: number): Promise<any> | void;
    clusterCommand(clusterID: string, message?: unknown, receptive?: boolean, returnTimeout?: number): Promise<any> | void;
    allClustersCommand(message?: unknown, receptive?: boolean, returnTimeout?: number, callback?: (clusterID: number, data?: any) => void): Promise<Map<number, any>> | void;
    getStats(): Promise<Stats>;
    getWorkers(): Promise<{
        clusters: Collection<number, ClusterCollection>;
        services: Collection<string, ServiceCollection>;
    }>;
    collectStats(): Promise<Stats>;
    restartCluster(clusterID: number, hard?: boolean): Promise<ClusterCollection | undefined>;
    restartAllClusters(hard?: boolean): void;
    restartService(serviceName: string, hard?: boolean): Promise<ServiceCollection | undefined>;
    restartAllServices(hard?: boolean): void;
    shutdownCluster(clusterID: number, hard?: boolean): Promise<ClusterCollection | undefined>;
    shutdownService(serviceName: string, hard?: boolean): Promise<ServiceCollection | undefined>;
    createService(serviceName: string, servicePath: string): Promise<ServiceCollection | undefined>;
    totalShutdown(hard?: boolean): void;
    reshard(options?: ReshardOptions): Promise<void>;
    clusterEval(clusterID: number, stringToEvaluate: string, receptive?: boolean, returnTimeout?: number): Promise<any> | void;
    allClustersEval(stringToEvaluate: string, receptive?: boolean, returnTimeout?: number, callback?: (clusterID: number, data?: any) => void): Promise<Map<number, any>> | void;
    serviceEval(serviceName: string, stringToEvaluate: string, receptive?: boolean, returnTimeout?: number): Promise<any> | void;
}
