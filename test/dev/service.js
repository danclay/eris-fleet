const { BaseServiceWorker } = require('../../dist/index');

module.exports = class ServiceWorker extends BaseServiceWorker {
    constructor(setup) {
        // Do not delete this super.
        super(setup);

        // Run this function when your service is ready for use. This MUST be run for the worker spawning to continue.
        console.log("Hi " + this.workerID)
        setTimeout(() => {
            this.serviceReady();
        }, 5000)
    }
    async handleCommand(dataSentInCommand) {
        // Return a response if you want to respond
        console.log(this.workerID);
        return "test";
    }
}