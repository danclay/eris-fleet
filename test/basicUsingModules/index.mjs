import {isMaster} from "cluster"
import {Fleet} from "../../dist/index.js"
import path from "path"
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {inspect} from "util"
import {BotWorker} from "./bot.mjs"

import dotenv from "dotenv"
dotenv.config()

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options = {
    BotWorker: BotWorker,
    token: process.env.token,
    startingStatus: {
        status: "dnd",
        game: {
            name: "Starting..."
        }
    }
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