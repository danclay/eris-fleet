// This is a test folder that was used during development. Do not consider this an example.
const { BaseClusterWorker } = require("../../dist/index");

module.exports = class BotWorker extends BaseClusterWorker {
	constructor (setup) {
		// Do not delete this super.
		super(setup);

		this.bot.on("messageCreate", this.handleMessage.bind(this));
	}

	async handleMessage (msg) {
		if (msg.content === "," && !msg.author.bot) {
			const test = await this.ipc.fetchMember(msg.guildID, msg.author.id);
			if (test) {
				this.bot.createMessage(msg.channel.id, test.id);
			} else {
				this.bot.createMessage(msg.channel.id, "Uh oh");
			}
		} else if (msg.content === "!shutdown") {
			this.ipc.totalShutdown();
		}
	}

	shutdown (done) {
		setTimeout(() => { done(); }, 5000);
	}
};
