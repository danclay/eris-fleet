// This file is used for CI testing. This should not be considered a practical example.
const { isMaster } = require('cluster');
const { Fleet } = require('../../dist/index');
const path = require('path');
const { inspect } = require('util');

require('dotenv').config();

const config = process.env.CI_CONFIG ? JSON.parse(process.env.CI_CONFIG) : undefined;

const options = {
    path: path.join(__dirname, "./bot.js"),
    token: config ? config.token : process.env.token,
    startingStatus: {
        status: "dnd",
        game: {
            name: "CI Test"
        }
    },
    clusters: 2,
    shards: 4,
    services: [{name: "service1", path: path.join(__dirname, "./service1.js")}, {name: "service2", path: path.join(__dirname, "./service2.js")}]
}

const Admiral = new Fleet(options);

if (isMaster) {
    // Code to only run for your master process
    Admiral.on('log', m => console.log(m));
    Admiral.on('debug', m => console.debug(m));
    Admiral.on('warn', m => console.warn(m));
    Admiral.on('error', m => {
        throw inspect(m);
    });

    // Logs stats when they arrive
    //Admiral.on('stats', m => console.log(inspect(m)));

    let i = 0;
    Admiral.on('ready', () => {
        i++;
        if (i === 1) {
            console.log("Starting test 1");
            Admiral.broadcast("test1");
        } else if (i === 2) {
            console.log("Starting restart test");
            Admiral.broadcast("test2");
        } else if (i === 3) {
            console.log("Starting reshard test");
            Admiral.broadcast("test3");
        } else if (i === 5) {
            console.log("Starting total shutdown test");
            Admiral.broadcast("test4");
        }
    })
}