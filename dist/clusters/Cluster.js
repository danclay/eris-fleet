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
        console.log = (str) => { if (process.send)
            process.send({ op: "log", msg: str, source: "Cluster " + this.clusterID }); };
        console.debug = (str) => { if (process.send)
            process.send({ op: "debug", msg: str, source: "Cluster " + this.clusterID }); };
        console.error = (str) => { if (process.send)
            process.send({ op: "error", msg: str, source: "Cluster " + this.clusterID }); };
        console.warn = (str) => { if (process.send)
            process.send({ op: "warn", msg: str, source: "Cluster " + this.clusterID }); };
        //Spawns
        process.on("uncaughtException", (err) => {
            if (process.send)
                process.send({ op: "error", msg: util_1.inspect(err) });
        });
        process.on("unhandledRejection", (reason, promise) => {
            if (process.send)
                process.send({ op: "error", msg: "Unhandled Rejection at: " + util_1.inspect(promise) + " reason: " + reason });
        });
        if (process.send)
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
                            if (process.send)
                                process.send({ op: "return", value: user, UUID: message.UUID });
                        }
                        else {
                            if (process.send)
                                process.send({ op: "return", value: { id: message.id, noValue: true }, UUID: message.UUID });
                        }
                        break;
                    }
                    case "fetchChannel": {
                        if (!this.bot)
                            return;
                        const channel = this.bot.getChannel(message.id);
                        if (channel) {
                            if (process.send)
                                process.send({ op: "return", value: channel, UUID: message.UUID });
                        }
                        else {
                            if (process.send)
                                process.send({ op: "return", value: { id: message.id, noValue: true }, UUID: message.UUID });
                        }
                        break;
                    }
                    case "fetchGuild": {
                        if (!this.bot)
                            return;
                        const guild = this.bot.guilds.get(message.id);
                        if (guild) {
                            if (process.send)
                                process.send({ op: "return", value: guild, UUID: message.UUID });
                        }
                        else {
                            if (process.send)
                                process.send({ op: "return", value: { id: message.id, noValue: true }, UUID: message.UUID });
                        }
                        break;
                    }
                    case "fetchMember": {
                        if (!this.bot)
                            return;
                        const messageParsed = JSON.parse(message.id);
                        const guild = this.bot.guilds.get(messageParsed.guildID);
                        if (guild) {
                            const member = guild.members.get(messageParsed.memberID);
                            if (member) {
                                const clean = member.toJSON();
                                clean.id = message.id;
                                if (process.send)
                                    process.send({ op: "return", value: clean, UUID: message.UUID });
                            }
                            else {
                                if (process.send)
                                    process.send({ op: "return", value: { id: message.id, noValue: true }, UUID: message.UUID });
                            }
                        }
                        else {
                            if (process.send)
                                process.send({ op: "return", value: { id: message.id, noValue: true }, UUID: message.UUID });
                        }
                        break;
                    }
                    case "return": {
                        if (this.app)
                            this.app.ipc.emit(message.id, message.value);
                        break;
                    }
                    case "collectStats": {
                        if (!this.bot)
                            return;
                        const shardStats = [];
                        const getShardUsers = (id) => {
                            let users = 0;
                            for (const [key, value] of Object.entries(this.bot.guildShardMap)) {
                                const guild = this.bot.guilds.find(g => g.id == key);
                                if (Number(value) == id && guild)
                                    users += guild.memberCount;
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
                        if (process.send)
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
                        if (this.app) {
                            if (this.app.shutdown) {
                                // Ask app to shutdown
                                this.app.shutdown(() => {
                                    this.bot.disconnect({ reconnect: false });
                                    if (process.send)
                                        process.send({ op: "shutdown" });
                                });
                            }
                            else {
                                this.bot.disconnect({ reconnect: false });
                                if (process.send)
                                    process.send({ op: "shutdown" });
                            }
                        }
                        else {
                            this.bot.disconnect({ reconnect: false });
                            if (process.send)
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
        if (this.whatToLog.includes("cluster_start"))
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
        this.bot = bot;
        const setStatus = () => {
            if (this.startingStatus) {
                if (this.startingStatus.game) {
                    this.bot.editStatus(this.startingStatus.status, this.startingStatus.game);
                }
                else {
                    this.bot.editStatus(this.startingStatus.status);
                }
            }
        };
        bot.on("connect", (id) => {
            if (this.whatToLog.includes("shard_connect"))
                console.log(`Shard ${id} connected!`);
        });
        bot.on("shardDisconnect", (err, id) => {
            if (!this.shutdown)
                if (this.whatToLog.includes("shard_disconnect"))
                    console.log(`Shard ${id} disconnected with error: ${util_1.inspect(err)}`);
        });
        bot.once("shardReady", () => {
            setStatus();
        });
        bot.on("shardReady", (id) => {
            if (this.whatToLog.includes("shard_ready"))
                console.log(`Shard ${id} is ready!`);
        });
        bot.on("shardResume", (id) => {
            if (this.whatToLog.includes("shard_resume"))
                console.log(`Shard ${id} has resumed!`);
        });
        bot.on("warn", (message, id) => {
            if (process.send)
                process.send({ op: "warn", msg: message, source: `Cluster ${this.clusterID}, Shard ${id}` });
        });
        bot.on("error", (error, id) => {
            if (process.send)
                process.send({ op: "error", msg: util_1.inspect(error), source: `Cluster ${this.clusterID}, Shard ${id}` });
        });
        bot.on("ready", () => {
            if (this.whatToLog.includes("cluster_ready"))
                console.log(`Shards ${this.firstShardID} - ${this.lastShardID} are ready!`);
        });
        bot.once("ready", () => {
            this.App = App;
            if (process.send)
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