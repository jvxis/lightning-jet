const {statSync} = require('fs');
const {execSync} = require('child_process');
const {withCommas} = require('../lnd-api/utils');
const constants = require('./constants');
const config = require('./config');
const path = require('path');
const logger = require('./logger');

const priority = constants.channeldb.sizeThreshold;

global.channelDbFile = global.channelDbFile || config.channelDbPath;

// channel.db size
if (!global.channelDbFile) {
  const conf = config.macaroonPath;
  if (!conf) return logger.error('macaroonPath is not defined in the config.json');
  const base = path.normalize(path.dirname(conf) + '/../../../');
  let cmd = 'find ' + base + ' -name channel.db 2> /dev/null';
  try {
    global.channelDbFile = execSync(cmd).toString().trim();
  } catch(error) {
    logger.error('error locating channel.db:', error.toString());
  }
}

module.exports = {
  getPath() {
    return global.channelDbFile;
  },
  printCheckSize() {
    let res = module.exports.checkSize();
    if (res.priority === priority.urgent) {
      console.error(constants.colorRed, res.msg);
    } else if (res.priority === priority.serious) {
      console.error(constants.colorYellow, res.msg);
    } else if (res.priority === priority.warning) {
      console.error(res.msg);
    } else {
      console.log(res.msg);
    }
  },
  checkSize() {
    if (!global.channelDbFile) {
      let msg = 'channel.db (BOLT database) was not found. It\'s likely Jet does not have read access to the channel.db file, or the file is located elsewhere (perhaps remotely). Consider locating the file manually to monitor its size. For more info: https://plebnet.wiki/wiki/Compacting_Channel_DB';
      return { msg: msg, priority: priority.warning, error: 'not found' };
    }

    try {
      const stats = statSync(global.channelDbFile);
      const size = global.testChannelDbSize || Math.round(stats.size / Math.pow(10, 6));  // in mbs
      const str = formatSize(size);
      const threshold = getSizeThreshold();

      let msg;
      if (size > threshold.urgent * 1000) {
        msg  = 'channel.db size ' + str + ' exceeds ' + threshold.urgent + ' gb';
        msg += '\nyou must prune & compact ASAP: https://plebnet.wiki/wiki/Compacting_Channel_DB';
        return { msg: msg, priority: priority.urgent, size: size, str: str }
      } else if (size > threshold.serious * 1000) {
        msg  = 'channel.db size ' + str + ' exceeds ' + threshold.serious + ' gb';
        msg += '\nconsider pruning & compacting: https://plebnet.wiki/wiki/Compacting_Channel_DB';
        return { msg: msg, priority: priority.serious, size: size, str: str }
      } else if (size > threshold.warning * 1000) {
        msg  = 'channel.db size ' + str + ' exceeds ' + threshold.warning + ' gb';
        msg += '\nfamiliarize yourself with compacting & pruning procedure: https://plebnet.wiki/wiki/Compacting_Channel_DB';
        return { msg: msg, priority: priority.warning, size: size, str: str }
      } else {
        msg  = 'channel.db size ' + str + ' is within normal limits';
        return { msg: msg, priority: priority.normal, size: size, str: str }
      }
    } catch(error) {
      logger.error(error.toString());
    }
  }
}

function getSizeThreshold() {
  const profiles = constants.channeldb.sizeProfiles;
  const profile = getSizeProfile();
  const thresholds = profiles[profile] || profiles.small;
  const custom = config.channeldb && config.channeldb.sizeThreshold;
  return Object.assign({}, thresholds, custom);
}

function getSizeProfile() {
  const profile = (config.channeldb && (config.channeldb.sizeProfile || config.channeldb.size)) ||
    config.boltDbSize ||
    config.boltdbSize ||
    config.boltdbsize ||
    'small';

  return profile.toString().toLowerCase();
}

function formatSize(size) {
  if (size < 1000) return size + ' mb';

  const gb = size / 1000;
  return withCommas(gb.toFixed(1)) + ' gb';
}
