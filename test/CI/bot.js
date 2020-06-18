// This file is used for CI testing. This should not be considered a practical example.
const { BaseClusterWorker } = require('../../dist/index');
const {inspect} = require("util");

module.exports = class BotWorker extends BaseClusterWorker {
    constructor(setup) {
        // Do not delete this super.
        super(setup);

        this.ipc.register("test1", () => {
            console.log("Sending message");
            this.bot.createMessage(process.env.channelID, "test1");
            this.bot.once('messageCreate', this.handleMessage.bind(this));
        });

        this.ipc.command("service1", "readyI");
    }

    async handleMessage(msg) {
        if (msg.content === "test1") {
            console.log("Message recieved. Now testing service 1.");
            this.ipc.command("service1", {test: "service 1"}, true).then(r => {
                if (r == "service 1") console.log("Message recieved. Now testing service 2.");
                else throw r;
                this.ipc.command("service2", {test: "service 2"}, true).then(r => {
                    if (r == "service 2") console.log("Message recieved. Moving to test 2");
                    else throw r;
                    this.ipc.fetchChannel(msg.channel.id).then(r => {
                        if (r.id == msg.channel.id) {
                            console.log("Channel fetch success. Moving to test 3");
                            this.ipc.fetchGuild(msg.guildID).then(r => {
                                if (r.id == msg.guildID) {
                                    console.log("Guild fetch success. Moving to test 4");
                                    this.ipc.fetchUser(msg.author.id).then(r => {
                                        if (r.id == msg.author.id) {
                                            console.log("User fetch success. Moving to test 5");
                                            this.ipc.fetchMember(msg.guildID, msg.author.id).then(r => {
                                                if (r.id == msg.author.id) {
                                                    console.log("Member fetch success. Moving to testing fetch failures.");
                                                    this.ipc.fetchChannel(1).then(r => {
                                                        if (r == null) {
                                                            console.log("Channel fetch failure is successful. Moving to test 6");
                                                            this.ipc.fetchGuild(1).then(r => {
                                                                if (r == null) {
                                                                    console.log("Guild fetch failure is successful. Moving to test 7");
                                                                    this.ipc.fetchUser(1).then(r => {
                                                                        if (r == null) {
                                                                            console.log("User fetch failure is successful. Moving to test 8");
                                                                            this.ipc.fetchMember(1, 1).then(r => {
                                                                                if (r == null) {
                                                                                    console.log("Member fetch failure is successful. Moving to phase 2.");
                                                                                    this.ipc.command("service1", "test1Complete");
                                                                                } else {
                                                                                    console.error(inspect(r));
                                                                                }
                                                                            }).catch(e => console.error(inspect(e)));
                                                                        } else {
                                                                            console.error(inspect(r));
                                                                        }
                                                                    }).catch(e => console.error(inspect(e)));
                                                                } else {
                                                                    console.error(inspect(r));
                                                                }
                                                            }).catch(e => console.error(inspect(e)));
                                                        } else {
                                                            console.error(inspect(r));
                                                        }
                                                    }).catch(e => console.error(inspect(e)));
                                                } else {
                                                    console.error(inspect(r));
                                                }
                                            }).catch(e => console.error(inspect(e)));
                                        } else {
                                            console.error(inspect(r));
                                        }
                                    }).catch(e => console.error(inspect(e)));
                                } else {
                                    console.error(inspect(r));
                                }
                            }).catch(e => console.error(inspect(e)));
                        } else {
                            console.error(inspect(r));
                        }
                    }).catch(e => console.error(inspect(e)));
                }).catch(e => console.error(inspect(e)));
            }).catch(e => console.error(inspect(e)));
        }
    }

    shutdown(done) {
        setTimeout(() => {done()}, 3000);
    }
}