/// <reference types="node" />
import { EventEmitter } from 'events';
export declare class IPC extends EventEmitter {
    private events;
    constructor();
    register(event: string, callback: Function): void;
    unregister(event: string): void;
    broadcast(op: string, message?: any): void;
    sendTo(cluster: number, op: string, message?: any): void;
    fetchUser(id: number): Promise<unknown>;
    fetchGuild(id: number): Promise<unknown>;
    fetchChannel(id: number): Promise<unknown>;
    fetchMember(guildID: number, memberID: number): Promise<unknown>;
    command(service: string, message?: any, receptive?: Boolean): Promise<unknown>;
    getStats(): Promise<unknown>;
    restartCluster(clusterID: number, hard?: Boolean): void;
    restartAllClusters(hard?: Boolean): void;
    restartService(serviceName: string, hard?: Boolean): void;
    restartAllServices(hard?: Boolean): void;
    shutdownCluster(clusterID: number, hard?: Boolean): void;
    shutdownService(serviceName: string, hard?: Boolean): void;
    /** Total shutdown of fleet */
    totalShutdown(hard?: Boolean): void;
}
