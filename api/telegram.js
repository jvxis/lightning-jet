// https://www.npmjs.com/package/node-telegram-bot-api

const config = require('./config');
const constants = require('./constants');
const {getPropSync} = require('../db/utils');
const {recordTelegramMessageSync} = require('../db/utils');

module.exports = {
  sendMessage(msg) {
    recordTelegramMessageSync(msg);
  },
  validateBot() {  // validate that the bot has everything to get started
    const token = config.telegramToken;
    if (!token) throw new Error('could not find telegram token. check your config file');
  }
}