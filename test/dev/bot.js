// This file is used for testing eris-fleet and should not be used as a practical example.

const { BaseClusterWorker } = require('../../dist/index');

module.exports = class BotWorker extends BaseClusterWorker {
    constructor(setup) {
        // Do not delete this super.
        super(setup);

        this.bot.on('messageCreate', this.handleMessage.bind(this));
    }

    async handleMessage(msg) {
        if (msg.content === "!sendCommand" && !msg.author.bot) {
            // Sends a command to the example service: "myService"
            const r = await this.ipc.command("myService", msg.author.id, true)
            console.log("test " + r)
        }
    }

    shutdown(done) {
        // Optional function to gracefully shutdown things if you need to.
        done(); // Use this function when you are done gracefully shutting down.
    }
}