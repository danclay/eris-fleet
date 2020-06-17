// This file is used for CI testing. This should not be considered a practical example.
const { BaseServiceWorker } = require('../../dist/index');

module.exports = class ServiceWorker extends BaseServiceWorker {
    constructor(setup) {
        super(setup);

        console.log("Service 1 constructor.");
        this.serviceReady();

        this.ipc.register("test2", () => {
            console.log("Restarting clusters");
            this.ipc.restartAllClusters();
        });
        this.ipc.register("test3", () => {
            console.log("Resharding");
            this.ipc.reshard();
        });
        this.ipc.register("test4", () => {
            console.log("Shutdown");
            this.ipc.totalShutdown();
        });
    }
    async handleCommand(dataSentInCommand) {
        return dataSentInCommand.test;
    }

    shutdown(done) {
        setTimeout(() => {done()}, 3000);
    }
}