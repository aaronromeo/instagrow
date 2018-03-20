require('dotenv').config();
const constants = require("./src/constants");
const Promise = require('bluebird');

'use strict';

const verifyInput = async (event) => {
  if (!event["account"]) {
    throw new Error("Incorrect configuration - missing account");
  }
}

module.exports.getFollowingAndFollowers = async (event, context, callback) => {
  let response = {};
  try {
    await verifyInput(event, callback);

    const username = event["account"];
    const config = require(`./config.${username}.json`);
    const accountsFollowing = require("./src/getAccountsFollowing");
    const accountFollowers = require("./src/getAccountFollowers");

    const getFollowingAndFollowersAsync = async () => {
      const numAccountsFollowing = await accountsFollowing.getAccountsFollowing(config, constants.settings.DATABASE_OBJECT);
      const numAccountFollowers = await accountFollowers.getAccountFollowers(config, constants.settings.DATABASE_OBJECT);

      return [numAccountsFollowing, numAccountFollowers]
    }

    constants.settings.DATABASE_OBJECT.handler.createInstance(config);

    const [numAccountsFollowing, numAccountFollowers] = await getFollowingAndFollowersAsync();
    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successful run`,
        data: {
          numAccountsFollowing: numAccountsFollowing,
          numAccountFollowers: numAccountFollower,
        }
      })
    };
  } catch(err) {
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
  } finally {
    callback(null, response);
  }
};

module.exports.updateInteractionActivity = async (event, context, callback) => {
  let response = {};
  try {
    await verifyInput(event, callback);

    const username = event["account"];
    const config = require(`./config.${username}.json`);
    const latestActivityOfFollowedAccounts = require("./src/getLatestActivityOfAccounts");

    const updateInteractionActivityAsync = async () => {
      return await latestActivityOfFollowedAccounts.getLatestActivityOfAccounts(config, constants.settings.DATABASE_OBJECT);
    }

    constants.settings.DATABASE_OBJECT.handler.createInstance(config);

    const log = await updateInteractionActivityAsync();
    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successful run`,
        data: {
          log: log,
        }
      })
    };
  } catch(err) {
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
  } finally {
    callback(null, response);
  }
};

module.exports.addPendingLikeMediaToQueue = async (event, context, callback) => {
  let response = {};
  try {
    await verifyInput(event, callback);

    const username = event["account"];
    const config = require(`./config.${username}.json`);
    const latestMediaOfFollowedAccounts = require("./src/getLatestMediaOfAccounts");
    const pendingLikeMediaToQueue = require("./src/addPendingLikeMediaToQueue");

    const addPendingLikeMediaToQueueAsync = async () => {
      const log = await latestMediaOfFollowedAccounts.getLatestMediaOfAccounts(config, constants.settings.DATABASE_OBJECT);
      log.concat(await pendingLikeMediaToQueue.addPendingLikeMediaToQueue(config, constants.settings.DATABASE_OBJECT));

      return log;
    }

    constants.settings.DATABASE_OBJECT.handler.createInstance(config);

    const log = await addPendingLikeMediaToQueueAsync();
    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successful run`,
        data: {
          log: log,
        }
      })
    };
  } catch(err) {
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
  } finally {
    callback(null, response);
  }
};

module.exports.updateLikedMedia = async (event, context, callback) => {
  let response = {};
  try {
    await verifyInput(event, callback);

    const username = event["account"];
    const config = require(`./config.${username}.json`);

    const likedMedia = require("./src/updateLikedMedia");

    const updateLikedMediaAsync = async () => {
      return await likedMedia.updateLikedMedia(config, constants.settings.DATABASE_OBJECT);
    }

    constants.settings.DATABASE_OBJECT.handler.createInstance(config);

    const log = await updateLikedMediaAsync();
    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successful run`,
        data: {
          log: log,
        }
      })
    };
  } catch(err) {
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
  } finally {
    callback(null, response);
  }
};
