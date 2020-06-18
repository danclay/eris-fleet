/// <reference types="node" />
import { EventEmitter } from "events";
import * as Admiral from "../sharding/Admiral";
export declare class IPC extends EventEmitter {
    private events;
    constructor();
    register(event: string, callback: (msg: unknown) => void): void;
    unregister(event: string): void;
    broadcast(op: string, message?: unknown): void;
    admiralBroadcast(op: string, message?: unknown): void;
    sendTo(cluster: number, op: string, message?: unknown): void;
    fetchUser(id: number): Promise<any>;
    fetchGuild(id: number): Promise<any>;
    fetchChannel(id: number): Promise<any>;
    fetchMember(guildID: number, memberID: number): Promise<any>;
    command(service: string, message?: unknown, receptive?: boolean): Promise<unknown>;
    getStats(): Promise<Admiral.Stats>;
    restartCluster(clusterID: number, hard?: boolean): void;
    restartAllClusters(hard?: boolean): void;
    restartService(serviceName: string, hard?: boolean): void;
    restartAllServices(hard?: boolean): void;
    shutdownCluster(clusterID: number, hard?: boolean): void;
    shutdownService(serviceName: string, hard?: boolean): void;
    /** Total shutdown of fleet */
    totalShutdown(hard?: boolean): void;
    reshard(): void;
}
