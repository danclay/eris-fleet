// This file is used for CI testing. This should not be considered a practical example.
const { isMaster } = require('cluster');
const { Fleet } = require('../../dist/index');
const path = require('path');
const { inspect } = require('util');

require('dotenv').config();

const options = {
    path: path.join(__dirname, "./bot.js"),
    token: process.env.token,
    startingStatus: {
        status: "dnd",
        game: {
            name: "CL Test"
        }
    },
    clusters: 6,
    shards: 12,
    services: [{name: "service1", path: path.join(__dirname, "./service1.js")}, {name: "service2", path: path.join(__dirname, "./service2.js")}]
}

const Admiral = new Fleet(options);

if (isMaster) {
    // Code to only run for your master process
    Admiral.on('log', m => console.log(m));
    Admiral.on('debug', m => console.debug(m));
    Admiral.on('warn', m => console.warn(m));
    Admiral.on('error', m => console.error(inspect(m)));

    
    // Logs stats when they arrive
    Admiral.on('stats', m => console.log(inspect(m)));
}