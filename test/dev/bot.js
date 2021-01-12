// This is a test folder that was used during development. Do not consider this an example.
const { BaseClusterWorker } = require("../../dist/index");

module.exports = class BotWorker extends BaseClusterWorker {
	constructor (setup) {
		// Do not delete this super.
		super(setup);

		this.bot.on("messageCreate", this.handleMessage.bind(this));
	}

	async handleMessage (msg) {
		if (msg.content.startsWith('!test')) {
			this.bot.createMessage(msg.channel.id, (await this.ipc.fetchMember(msg.content.replace('!test', ""), msg.author.id)).id)
		}
		if (msg.content.startsWith('!a')) {
			this.bot.createMessage(msg.channel.id, "t")
		}
	}

	shutdown (done) {
		setTimeout(() => { done(); }, 5000);
	}
};
