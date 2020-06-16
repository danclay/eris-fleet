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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cluster = void 0;
const Eris = __importStar(require("eris"));
const cluster_1 = require("cluster");
const util_1 = require("util");
class Cluster {
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
                        this.firstShardID = message.firstShardID;
                        this.lastShardID = message.lastShardID;
                        this.path = message.path;
                        this.clusterID = message.clusterID;
                        this.clusterCount = message.clusterCount;
                        this.shardCount = message.shardCount;
                        this.shards = (this.lastShardID - this.firstShardID) + 1;
                        this.clientOptions = message.clientOptions;
                        this.token = message.token;
                        this.whatToLog = message.whatToLog;
                        if (message.startingStatus)
                            this.startingStatus = message.startingStatus;
                        if (this.shards < 0)
                            return;
                        this.connect();
                        break;
                    }
                    case "fetchUser": {
                        if (!this.bot)
                            return;
                        const user = this.bot.users.get(message.id);
                        if (user) {
                            //@ts-ignore
                            process.send({ op: "return", value: user, UUID: message.UUID });
                        }
                        break;
                    }
                    case "fetchChannel": {
                        if (!this.bot)
                            return;
                        const channel = this.bot.getChannel(message.id);
                        if (channel) {
                            //@ts-ignore
                            process.send({ op: "return", value: channel, UUID: message.UUID });
                        }
                        break;
                    }
                    case "fetchGuild": {
                        if (!this.bot)
                            return;
                        const guild = this.bot.guilds.get(message.id);
                        if (guild) {
                            //@ts-ignore
                            process.send({ op: "return", value: guild, UUID: message.UUID });
                        }
                        break;
                    }
                    case "fetchMember": {
                        if (!this.bot)
                            return;
                        const [guildID, memberID] = message.id;
                        const guild = this.bot.guilds.get(guildID);
                        if (guild) {
                            let member = guild.members.get(memberID);
                            if (member) {
                                //@ts-ignore
                                member = member.toJSON();
                                //@ts-ignore
                                process.send({ op: "fetchReturn", value: member, UUID: message.UUID });
                            }
                        }
                        break;
                    }
                    case "return": {
                        this.app.ipc.emit(message.id, message.value);
                        break;
                    }
                    case "collectStats": {
                        if (!this.bot)
                            return;
                        let shardStats = [];
                        const getShardUsers = (id) => {
                            let users = 0;
                            for (let [key, value] of Object.entries(this.bot.guildShardMap)) {
                                if (Number(value) == id)
                                    users += this.bot.guilds.find(g => g.id == key).memberCount;
                            }
                            return users;
                        };
                        this.bot.shards.forEach(shard => {
                            shardStats.push({
                                id: shard.id,
                                ready: shard.ready,
                                latency: shard.latency,
                                status: shard.status,
                                guilds: Object.values(this.bot.guildShardMap).filter(e => e == shard.id).length,
                                users: getShardUsers(shard.id)
                            });
                        });
                        //@ts-ignore
                        process.send({ op: "collectStats", stats: {
                                guilds: this.bot.guilds.size,
                                users: this.bot.users.size,
                                uptime: this.bot.uptime,
                                voice: this.bot.voiceConnections.size,
                                largeGuilds: this.bot.guilds.filter(g => g.large).length,
                                shardStats: shardStats,
                                ram: process.memoryUsage().rss / 1e6
                            } });
                        break;
                    }
                    case "shutdown": {
                        this.shutdown = true;
                        if (this.app.shutdown) {
                            let safe = false;
                            // Ask app to shutdown
                            this.app.shutdown(() => {
                                safe = true;
                                this.bot.disconnect({ reconnect: false });
                                //@ts-ignore
                                process.send({ op: "shutdown" });
                            });
                            if (message.killTimeout > 0) {
                                setTimeout(() => {
                                    if (!safe) {
                                        console.error(`Cluster ${this.clusterID} took too long to shutdown. Performing shutdown anyway.`);
                                        this.bot.disconnect({ reconnect: false });
                                        //@ts-ignore
                                        process.send({ op: "shutdown" });
                                    }
                                }, message.killTimeout);
                            }
                        }
                        else {
                            this.bot.disconnect({ reconnect: false });
                            //@ts-ignore
                            process.send({ op: "shutdown" });
                        }
                        break;
                    }
                    case "loadCode": {
                        this.loadCode();
                        break;
                    }
                }
            }
        });
    }
    async connect() {
        //@ts-ignore
        if (this.whatToLog.includes('cluster_start'))
            console.log(`Connecting with ${this.shards} shard(s)`);
        const options = Object.assign(this.clientOptions, { autoreconnect: true, firstShardID: this.firstShardID, lastShardID: this.lastShardID, maxShards: this.shardCount });
        let App = (await Promise.resolve().then(() => __importStar(require(this.path))));
        let bot;
        if (App.Eris) {
            bot = new App.Eris.Client(this.token, options);
            App = App.BotWorker;
        }
        else {
            bot = new Eris.Client(this.token, options);
            if (App.BotWorker) {
                App = App.BotWorker;
            }
            else {
                App = App.default ? App.default : App;
            }
        }
        ;
        this.bot = bot;
        const setStatus = () => {
            if (this.startingStatus) {
                if (this.startingStatus.game) {
                    let statusGame = {
                        name: this.startingStatus.game.name
                    };
                    //@ts-ignore
                    if (this.startingStatus.game.type)
                        statusGame.type = this.startingStatus.game.type;
                    //@ts-ignore
                    if (this.startingStatus.game.url)
                        statusGame.url = this.startingStatus.game.url;
                    //@ts-ignore
                    this.bot.editStatus(this.startingStatus.status, statusGame);
                }
                else {
                    //@ts-ignore
                    this.bot.editStatus(this.startingStatus.status);
                }
            }
        };
        bot.on("connect", (id) => {
            //@ts-ignore
            if (this.whatToLog.includes('shard_connect'))
                console.log(`Shard ${id} connected!`);
        });
        bot.on("shardDisconnect", (err, id) => {
            //@ts-ignore
            if (!this.shutdown)
                if (this.whatToLog.includes('shard_disconnect'))
                    console.log(`Shard ${id} disconnected with error: ${util_1.inspect(err)}`);
        });
        bot.once("shardReady", () => {
            setStatus();
        });
        bot.on("shardReady", (id) => {
            //@ts-ignore
            if (this.whatToLog.includes('shard_ready'))
                console.log(`Shard ${id} is ready!`);
        });
        bot.on("shardResume", (id) => {
            //@ts-ignore
            if (this.whatToLog.includes('shard_resume'))
                console.log(`Shard ${id} has resumed!`);
        });
        bot.on("warn", (message, id) => {
            //@ts-ignore
            console.warn(`Shard ${id} | ${message}`);
        });
        bot.on("error", (error, id) => {
            //@ts-ignore
            console.error(`Shard ${id} | ${util_1.inspect(error)}`);
        });
        bot.on("ready", (id) => {
            //@ts-ignore
            if (this.whatToLog.includes('cluster_ready'))
                console.log(`Shards ${this.firstShardID} - ${this.lastShardID} are ready!`);
        });
        bot.once("ready", () => {
            this.App = App;
            //@ts-ignore
            process.send({ op: "connected" });
        });
        // Connects the bot
        bot.connect();
    }
    async loadCode() {
        //let App = (await import(this.path)).default;
        //App = App.default ? App.default : App;
        this.app = new this.App({ bot: this.bot, clusterID: this.clusterID, workerID: cluster_1.worker.id });
    }
}
exports.Cluster = Cluster;
//# sourceMappingURL=Cluster.js.map