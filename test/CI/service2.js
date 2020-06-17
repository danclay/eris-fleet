// This file is used for CI testing. This should not be considered a practical example.
const { BaseServiceWorker } = require('../../dist/index');

module.exports = class ServiceWorker extends BaseServiceWorker {
    constructor(setup) {
        super(setup);

        console.log("Service 2 constructor.");
        setTimeout(() => {this.serviceReady()}, 3000);
    }
    async handleCommand(dataSentInCommand) {
        return dataSentInCommand.test;
    }

    shutdown(done) {
        setTimeout(() => {done()}, 3000);
    }
}