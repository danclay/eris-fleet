const { BaseClusterWorker } = require('../../dist/index');

module.exports = class BotWorker extends BaseClusterWorker {
    constructor(setup) {
        // Do not delete this super.
        super(setup);

        console.log(this.workerID + " is good to go!");

        this.bot.on('messageCreate', this.handleMessage.bind(this));
    }

    async handleMessage(msg) {
        if (msg.content === "!ping" && !msg.author.bot) {
            const r = await this.ipc.command("service1", null, true);
            this.bot.createMessage(msg.channel.id, r);
        } else if (msg.content == "!restartServices" && !msg.author.bot) {
            this.restartService('service1');
        } else if (msg.content == "!shutdownCluster" && !msg.author.bot) {
            this.totalShutdown();
        }
    }

    async shutdown(safe) {
        setTimeout(() => {
            safe();
        }, 5000);
    }
}