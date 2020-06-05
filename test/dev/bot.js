const { BaseClusterWorker } = require('../../dist/index');

module.exports = class BotWorker extends BaseClusterWorker {
    constructor(setup) {
        // Do not delete this super.
        super(setup);

        this.bot.on('messageCreate', this.handleMessage.bind(this));
    }

    async handleMessage(msg) {
        if (msg.content === "!ping" && !msg.author.bot) {
            this.bot.createMessage(msg.channel.id, "Pong!");
            this.restartCluster(1);
        }
    }
}