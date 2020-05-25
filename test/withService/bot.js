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
            const reply = await this.ipc.command("myService", {smileyFace: ":)"}, true);
            //console.log(reply);
            this.bot.createMessage(msg.channel.id, reply);
        }
    }
}