const { isMaster } = require('cluster');
const { Fleet } = require('../../dist/index');
const path = require('path');
const { inspect } = require('util');

require('dotenv').config();

const options = {
    path: path.join(__dirname, "./bot.js"),
    token: process.env.token,
    clusters: 1,
    shards: 1,
    whatToLog: {blacklist: ['stats_update']},
    //services: [{name: 'service1', path: path.join(__dirname, "./service.js")}],
    serviceTimeout: 1000,
    killTimeout: 1000
}
const Admiral = new Fleet(options);

if (isMaster) {
    // Code to only run for your master process
    Admiral.on('log', m => console.log(m));
    Admiral.on('debug', m => console.debug(m));
    Admiral.on('warn', m => console.warn(m));
    Admiral.on('error', m => console.error(inspect(m)));

    
    // Logs stats when they arrive
    //Admiral.on('stats', m => console.log(m));
}