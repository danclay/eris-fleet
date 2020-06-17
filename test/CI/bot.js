// This file is used for CI testing. This should not be considered a practical example.
const { BaseClusterWorker } = require('../../dist/index');

module.exports = class BotWorker extends BaseClusterWorker {
    constructor(setup) {
        // Do not delete this super.
        super(setup);

        this.ipc.register("test1", () => {
            console.log("Sending message");
            this.bot.createMessage(process.env.channelID, "test");
            this.bot.on('messageCreate', this.handleMessage.bind(this));
        });
    }

    async handleMessage(msg) {
        if (msg.content === "test") {
            this.bot.createMessage(msg.channel.id, "Message recieved. Now testing service 1");
            console.log("Message recieved. Now testing service 1.");
            this.ipc.command("service1", {test: "service 1"}, true).then(r => {
                this.bot.createMessage(msg.channel.id, r);
                console.log("Message recieved. Now testing service 2.");
                this.ipc.command("service2", {test: "service 2"}, true).then(r => {
                    this.bot.createMessage(msg.channel.id, r);
                    console.log("Message recieved. Moving to restart services");
                    this.ipc.restartAllServices();
                }).catch(e => console.error(e));
            }).catch(e => console.error(e));
        }
    }

    shutdown(done) {
        setTimeout(() => {done()}, 3000);
    }
}