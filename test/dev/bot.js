const { BaseClusterWorker } = require('../../dist/index');

module.exports = class BotWorker extends BaseClusterWorker {
    constructor(setup) {
        // Do not delete this super.
        super(setup);

        this.bot.on('messageCreate', this.handleMessage.bind(this));
    }

    async handleMessage(msg) {
        if (msg.content === "," && !msg.author.bot) {
            this.bot.createMessage(msg.channel.id, "restarting!");
            this.ipc.totalShutdown();
            //this.ipc.reshard();
        } else if (msg.content === ".") {
            this.bot.createMessage(msg.channel.id, "hi!");
        }
    }

    shutdown(done) {
        setTimeout(() => {done()}, 5000);
    }
}