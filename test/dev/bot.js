// This is a test folder that was used during development. Do not consider this an example.
const { BaseClusterWorker } = require("../../dist/index");

module.exports = class BotWorker extends BaseClusterWorker {
	constructor (setup) {
		// Do not delete this super.
		super(setup);

		this.bot.on("messageCreate", this.handleMessage.bind(this));

		this.ipc.register('yeet', (msg) => {
			console.log("1 " + msg.op)
		})

		this.ipc.register('yeet', (msg) => {
			console.log("2 " + msg.op)
		})
	}

	async handleMessage (msg) {
		if (msg.content === '!test') {
			this.ipc.broadcast('yeet', 'yes')
		}
	}

	shutdown (done) {
		setTimeout(() => { done(); }, 5000);
	}
};
