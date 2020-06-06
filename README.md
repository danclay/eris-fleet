<div align="center">
  <p>
    <a href="https://www.npmjs.com/package/eris-fleet"><img src="https://img.shields.io/npm/v/eris-fleet.svg?cacheSeconds=3600&style=flat-square" alt="NPM version" /></a>
    <a href="https://raw.githubusercontent.com/danclay/eris-fleet/master/LICENSE"><img alt="License" src="https://img.shields.io/npm/l/eris-fleet?style=flat-square">
    <a href="https://david-dm.org/danclay/eris-fleet/"><img src="https://img.shields.io/david/danclay/eris-fleet.svg?cacheSeconds=3600&style=flat-square" alt="Dependencies" /></a>
  </p>
  <p>
    <a href="https://nodei.co/npm/eris-fleet/"><img src="https://nodeico.herokuapp.com/eris-fleet.svg"></a>
  </p>
</div>

# About

A spin-off of [eris-sharder](https://github.com/discordware/eris-sharder) and [megane](https://github.com/brussell98/megane) with services and configurable logging.

# Installation
Run `npm install eris-fleet`
or with yarn: `yarn add eris-fleet`

# Basics

Some working examples are in [test/](https://github.com/danclay/eris-fleet/tree/master/test).

## Naming Conventions
| Term | Description |
|-----------|----------------------------------------------------------------------------|
| "fleet" | All the components below |
| "admiral" | A single sharding manager |
| "worker" | A worker for node clustering |
| "cluster" | A worker containing Eris shards |
| "service" | A worker that does not contain Eris shards, but can interact with clusters |

## Get Started
To get started, you will need at least 2 files:
1. Your file which will create the fleet. This will be called "index.js" for now.
2. Your file containing your bot code. This will be called "bot.js" for now. This file will extend `BaseClusterWorker`

In the example below, the variable `options` is passed to the admiral. [Read below](#admiral) for what options you can pass.

Here is an example of `index.js`:
```js
const { isMaster } = require('cluster');
const { Fleet } = require('eris-fleet');
const path = require('path');
const { inspect } = require('util');

require('dotenv').config();

const options = {
    path: path.join(__dirname, "./bot.js"),
    token: process.env.token
}

const Admiral = new Fleet(options);

if (isMaster) {
    // Code to only run for your master process
    Admiral.on('log', m => console.log(m));
    Admiral.on('debug', m => console.debug(m));
    Admiral.on('warn', m => console.warn(m));
    Admiral.on('error', m => console.error(inspect(m)));

    // Logs stats when they arrive
    Admiral.on('stats', m => console.log(m));
}
```
This creates a new Admiral that will manage `bot.js` running in other processes.

The following is an example of `bot.js`. [Read below](#ipc) for what you can access and do with clusters.
```js
const { BaseClusterWorker } = require('eris-fleet');

module.exports = class BotWorker extends BaseClusterWorker {
    constructor(setup) {
        // Do not delete this super.
        super(setup);

        this.bot.on('messageCreate', this.handleMessage.bind(this));

        // Demonstration of the properties the cluster has (Keep reading for info on IPC):
        console.log(this.workerID); // ID of the worker
        console.log(this.clusterID); // The ID of the cluster
    }

    async handleMessage(msg) {
        if (msg.content === "!ping" && !msg.author.bot) {
            this.bot.createMessage(msg.channel.id, "Pong!");
        }
    }

    shutdown(done) {
        // Optional function to gracefully shutdown things if you need to.
        done(); // Use this function when you are done gracefully shutting down.
    }
}
```
The bot above will respond with "Pong!" when it recieves the command "!ping". **Make sure your bot file extends BaseClusterWorker!**

## Services

You can create services for your bot. Services are workers which do not interact directly with Eris. Services are useful for processing tasks, a central location to get the latest version of languages for your bot, custom statistics, and more! [Read below](#ipc) for what you can access and do with services. To add a service, add the following to the options you pass to the fleet:
```js
const options = {
    // Your other options...
    services: [{name: "myService", path: path.join(__dirname, "./service.js")}]
}
```
Add a new array element for each service you want to register. Make sure each service has a unique name or else the fleet will crash.

Here is an example of `service.js`:
```js
const { BaseServiceWorker } = require('eris-fleet');

module.exports = class ServiceWorker extends BaseServiceWorker {
    constructor(setup) {
        // Do not delete this super.
        super(setup);

        // Run this function when your service is ready for use. This MUST be run for the worker spawning to continue.
        this.serviceReady();

        // Demonstration of the properties the service has (Keep reading for info on IPC):
        console.log(this.workerID); // ID of the worker
        console.log(this.serviceName); // The name of the service

    }
    // This is the function which will handle commands
    async handleCommand(dataSentInCommand) {
        // Return a response if you want to respond
        return dataSentInCommand.smileyFace;
    }

    shutdown(done) {
        // Optional function to gracefully shutdown things if you need to.
        done(); // Use this function when you are done gracefully shutting down.
    }
}
```
**Make sure your bot file extends BaseServiceWorker!**
This service will simply return a value within an object sent to it within the command message called "smileyFace". Services can be used for much more than this though. To send a command to this service, you could use this:
```js
const reply = await this.ipc.command("myService", {smileyFace: ":)"}, true);
this.bot.createMessage(msg.channel.id, reply);
```
This command is being sent using the IPC. In this command, the first argument is the name of the service to send the command to, the second argument is the message to send it (in this case a simple object), and the third argument is whether you want a response (this will default to false unless you specify "true"). If you want a response, you must `await` the command or use `.then()`.

### Handling service errors

If you encounter an error while starting your service, run `this.serviceStartingError('error here')` instead of `this.serviceReady()`. Using this will report an error and restart the worker. **Note that services always start before the clusters, so if your service keeps having starting errors your bot will be stuck in a loop.** This issue may be fixed in the future from some sort of maxRestarts option, but this is currently not a functionality.

If you encounter an error when processing a command within your service, you can do the following to reject the promise:
```js
// handleCommand function within the ServiceWorker class
async handleCommand(dataSentInCommand) {
    // Rejects the promise
    return {err: "Uh oh.. an error!"};
}
```
When sending the command, you can do the following to deal with the error:
```js
this.ipc.command("myService", {smileyFace: ":)"}, true).then((reply) => {
    // A successful response
    this.bot.createMessage(msg.channel.id, reply);
}).catch((e) => {
    // Do whatever you want with the error
    console.error(e);
});
```

# In-depth

Below is more in-depth documentation.

## Admiral 

Here is a complete list of options you can pass to the Admiral through the Fleet constructor.
| Property       | Description                                                                                                                                  | Optional? | Default Value             |
|----------------|----------------------------------------------------------------------------------------------------------------------------------------------|-----------|---------------------------|
| path           | Absolute path to your bot file                                                                                                               | No        |                           |
| token          | Token for your bot                                                                                                                           | No        |                           |
| guildsPerShard | How many guild per shard                                                                                                                     | Yes       | 1300                      |
| shards         | How many shards you want (overrides guildsPerShard)                                                                                          | Yes       | 'auto'                    |
| clusters       | How many clusters you want to spawn  (this is overridden if there are more chunks than clusters specified)                                   | Yes       | # of CPU Cores            |
| clientOptions  | Options to pass to the Eris client                                                                                                           | Yes       |                           |
| timeout        | How long to wait for shards to connect to Discord (in ms)                                                                                    | Yes       | 30000                     |
| serviceTimeout | How long to wait for services to tell the admiral they are ready for use (in ms)                                                             | Yes       | infinite                  |
| clusterTimeout | How long to wait between connecting clusters to Discord (in ms)                                                                              | Yes       | 5000                      |
| nodeArgs       | Node arguments to pass to clusters                                                                                                           | Yes       |                           |
| statsInterval  | How often to update the stats (in ms) after all clusters are connected. To disable stats, set to 'disable'                                   | Yes       | 60000                     |
| services       | Services to register. An array of the following object:  `{name: "name of your service", path: "absolute path to your service"}`             | Yes       |                           |
| firstShardID   | The ID of the first shard to use for this fleet. Use this if you have multiple fleets running on separate machines (really, really big bots) | Yes       | 0                         |
| lastShardID    | The ID of the first shard to use for this fleet. Use this if you have multiple fleets running on separate machines (really, really big bots) | Yes       | Total count of shards - 1 |
| lessLogging    | Reduces the number of logs the Admiral sends (boolean)                                                                                       | Yes       | false                     |
| whatToLog      | Choose what to log (see details below)                                                                                                       | Yes       |                           |
| whatToLog.whitelist | Whitelist for lessLogging                                                                                                             | Yes       |                     |
| whatToLog.blacklist | Blacklist for lessLogging                                                                                                             | Yes       |                     |
| killTimeout    | Timeout before killing the proccess during shutdown                                                                                          | Yes       | infinite                  |

### Choose what to log

You can choose what to log by using the `whatToLog` property in the options object. You can choose either a whitelist or a blacklist of what to log. You can select what to log by using an array. To possible array elements are `['gateway_shards', 'admiral_start', 'shards_spread', 'stats_update', 'all_clusters_launched', 'all_services_launched', 'cluster_launch', 'service_launch', 'cluster_start', 'service_start', 'service_ready', 'cluster_ready', 'shard_connect', 'shard_ready', 'shard_disconnect', 'shard_resume', 'service_restart', 'cluster_restart', 'service_shutdown', 'cluster_shutdown', 'total_shutdown']`. Here is an example of choosing what to log:
```js
const options = {
    // Your other options
    whatToLog: {
        // This will only log when the admiral starts, when clusters are ready, and when services are ready.
        whitelist: ['admiral_start', 'cluster_ready', 'service_ready']
    }
};
```
Change `whitelist` to `blacklist` if you want to use a blacklist. Change the array as you wish. **Errors and warnings will always be sent.**

## IPC

Clusters and services can use IPC to interact with other clusters, the Admiral, and services. Here are all the IPC uses:

### Logging

| Name  | Example                                      | Description                                           |
|-------|----------------------------------------------|-------------------------------------------------------|
| log   | `process.send({op: "log", msg: "hello!"})`   | Logs an event your `index.js` file can process.       |
| debug | `process.send({op: "debug", msg: "hello!"})` | Logs a debug event your `index.js` file can process.  |
| error | `process.send({op: "error", msg: "uh oh!"})` | Logs an error event your `index.js` file can process. |
| warn  | `process.send({op: "warn", msg: "stuff"})`   | Logs a warn event your `index.js` file can process.   |

### Restart clusters

To restart clusters, you can do the following in your bot.js file. 0 is a placeholder for the ID of the cluster you wish to restart.
```js
this.ipc.restartCluster(0);
```
The above code will restart the cluster while avoiding downtime, meaning it will only kill the original worker after the new worker is ready. If you want to kill the worker immediately, use `this.ipc.restartCluster(0, true)`. The second argument is whether you want to preform a hard restart. This is false by default. 

You can also restart all the clusters. You can do this by using
```js
this.ipc.restartAllClusters();
```
If you want to preform a hard restart, use `this.ipc.restartAllClusters(true)`.

### Shutdown clusters

You can shutdown clusters. Use the following to shutdown clusters:
```js
this.ipc.shutdownCluster(0);
```
The above code will shutdown the cluster gracefully. If you would like to kill the worker immediately, use `this.ipc.shutdownCluster(0, true)`.
**You cannot restart a cluster after shutting it down.** A future update may allow this.

### Restart services

To restart services, you can do the following in your bot.js file. "myService" is a placeholder for the name of the service you wish to restart.
```js
this.ipc.restartService("myService");
```
The above code will restart the service while avoiding downtime, meaning it will only kill the original worker after the new worker is ready. All commands will be sent to the original worker until the new worker is ready. If you want to kill the worker immediately, use `this.ipc.restartService("myService", true)`. The second argument is whether you want to preform a hard restart. This is false by default. 

You can also restart all the clusters. You can do this by using 
```js
this.ipc.restartAllServices();
```
If you want to preform a hard restart, use `this.ipc.restartAllClusters(true)`.

### Shutdown services

You can shutdown services. Use the following to shutdown services:
```js
this.ipc.shutdownService("myService");
```
The above code will shutdown the service gracefully. If you would like to kill the worker immediately, use `this.ipc.shutdownService("myService", true)`.
**You cannot restart a service after shutting it down.** A future update may allow this.

### Total shutdown

You can totally shutdown your fleet using the following:
```js
this.ipc.totalShutdown();
```
The above code will shutdown the service gracefully. If you would like to kill the worker immediately, use `this.ipc.totalShutdown(true)`.
**A total shutdown exits all processes, including the master process.**

### Register

You can register certain events to a callback. This can recieve [broadcasts](#broadcast) and stats. The object sent in the callback is `{op: "the event's name", msg: "the message"}`. Here is an example of registering an event:
```js
this.ipc.register("stats", (message) => {
  // Do stuff
  console.log(message.msg);
});
```

### Unregister

You can unregister events you registered above.
```js
this.ipc.unregister("stats");
```

### Broadcast to all clusters

You can broadcast events that other clusters can recieve by [registering](#register) with the event. The first argument is the name of the event you are broadcasting (this should match the name of the event other clusters are registered to). The second argument is optional and is the the message you want to send. Note that the cluster sending this will also recieve the broadcast since this broadcasts to **all** clusters.
```js
this.ipc.broadcast("hello clusters!", "Want to chat?");
```

### Send to a specific cluster

You can send a message from one cluster to another specific cluster based on the cluster ID. The first argument is the ID of the cluster to send the message to. The second argument is the name of the event the other cluster should be registered to. The third argument is optional and is the message to send.
```js
this.ipc.sendTo(1, "Hello cluster 1!", "Squad up?");
```

### Fetch a user

Fetches a user from another cluster. Not much to explain here. The only argument used should be the ID of the user. Be sure to `await` this or use `.then()`
```js
await this.ipc.fetchUser(123456789);
```

### Fetch a guild

Fetches a guild from another cluster. The only argument used should be the ID of the guild. Be sure to `await` this or use `.then()`
```js
await this.ipc.fetchGuild(123456789);
```

### Fetch a channel

Fetches a channel from another cluster. The only argument used should be the ID of the channel. Be sure to `await` this or use `.then()`
```js
await this.ipc.fetchChannel(123456789);
```

### Fetch a member

Fetches a member from another cluster. The first argument should be the ID of the member. The second argument should the be ID of the guild the member is in. Be sure to `await` this or use `.then()`
```js
await this.ipc.fetchMember(123456789, 987654321); 
```

### Send a command to a service

Send a command to a service. The arguments are as follows:
| Argument  | Description                    | Optional? | Default |
|-----------|--------------------------------|-----------|---------|
| 1st       | Name of the service            | No        |         |
| 2nd       | Message to send to the command | Yes       | null    |
| 3rd       | If you want a response or not  | Yes       | false   |
Be sure to use `await` or `.then()`, especially if you expect a response.
```js
await this.ipc.command("ServiceName", "hello service!", true); 
```

### Get the latest stats

Gets the latest stats. This is an alternative to [registering](#register) the "stats" event. Be sure to use `await` or `.then()`
```js
await this.ipc.getStats();
```

## Using a specific version of eris or a modified version of eris

Eris-fleet is able to use packages such as eris-additions if you desire. To do so, modify your bot file to match the following template:
```js
const { BaseClusterWorker } = require('eris-fleet');

// Example using eris-additions
const Eris = require("eris-additions")(require("eris"));

class BotWorker extends BaseClusterWorker {
    constructor(setup) {
        super(setup);
        // Your cool stuff
    }
}

// This export is needed for this to work.
module.exports = {BotWorker, Eris};
```