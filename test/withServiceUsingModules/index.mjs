import { isMaster } from 'cluster';
import { Fleet } from '../../dist/index.js';
import { inspect } from 'util';
import { ServiceWorker } from "./service.mjs";
import { BotWorker } from './bot.mjs';

import dotenv from "dotenv"
dotenv.config()

const options = {
    BotWorker,
    token: process.env.token,
    services: [{name: "myService", ServiceWorker}]
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