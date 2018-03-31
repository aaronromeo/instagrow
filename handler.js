require('dotenv').config();
const Promise = require('bluebird');
const constants = require("./src/constants");
const dynamoDBHandler = require("./src/services/dynamodb").handler;

const getSetupVars = async (event) => {
  const username = event["account"] || process.env.ACCOUNT;
  if (!username) {
    throw new Error("Incorrect configuration - missing account");
  }

  return {
    username,
  };
}

module.exports.setUpNewApplication = async (event, context, callback) => {
  let response = {};
  try {
    dynamoDBHandler.createInstance();
    dynamoDBHandler.getInstance().createGeneralDB();

    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successful run`,
      })
    };
  } catch(err) {
    console.error(`Error ${err}`);
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

module.exports.setUpNewUserConfig = async (event, context, callback) => {
  let response = {};
  try {
    const username = process.env.ACCOUNT;
    const password = process.env.PASSWORD;
    const followingInteractionDeltaInDays = process.env.FOLLOWING_INTERACTION_DELTA_IN_DAYS || constants.FOLLOWING_INTERACTION_DELTA_IN_DAYS;
    const followerInteractionDeltaInDays = process.env.FOLLOWER_INTERACTION_DELTA_IN_DAYS || constants.FOLLOWER_INTERACTION_DELTA_IN_DAYS;

    if (!username) {
      throw new Error("Incorrect configuration - missing username");
    }

    if (!password) {
      throw new Error("Incorrect configuration - missing password");
    }

    dynamoDBHandler.createInstance();
    await dynamoDBHandler.getInstance().putUserAuthentication(username, password);
    await dynamoDBHandler.getInstance().putUserEnabled(username, false);
    await dynamoDBHandler.getInstance().putUserFollowingInteractionDeltaInDays(username, followingInteractionDeltaInDays);
    await dynamoDBHandler.getInstance().putUserFollowerInteractionDeltaInDays(username, followerInteractionDeltaInDays);

    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successful run`,
      })
    };
  } catch(err) {
    console.error(`Error ${err}`);
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

module.exports.setUpScalingPolicy = async (event, context, callback) => {
  let response = {};
  try {
    const username = process.env.ACCOUNT;

    if (!username) {
      throw new Error("Incorrect configuration - missing username");
    }

    dynamoDBHandler.createInstance();
    await dynamoDBHandler.getInstance().createAccountScalingPolicy(username);

    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successful run`,
      })
    };
  } catch(err) {
    console.error(`Error ${err}`);
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

module.exports.getFollowingAndFollowers = async (event, context, callback) => {
  let response = {};
  try {
    const accountsFollowing = require("./src/getAccountsFollowing");
    const accountFollowers = require("./src/getAccountFollowers");

    const getFollowingAndFollowersAsync = async ({username, password}) => {
      const numAccountsFollowing = await accountsFollowing.getAccountsFollowing({username, password});
      const numAccountFollowers = await accountFollowers.getAccountFollowers({username, password});
      return [numAccountsFollowing, numAccountFollowers];
    }

    dynamoDBHandler.createInstance();
    const username = await dynamoDBHandler.getInstance().getNextUserForFunction('getFollowingAndFollowers');
    if (!username) throw new Error("No username defined for function 'getFollowingAndFollowers'");

    const password = await dynamoDBHandler.getInstance().getPasswordForUser(username);
    if (!password) throw new Error("No password defined for function 'getFollowingAndFollowers'");

    const [numAccountsFollowing, numAccountFollowers] = await getFollowingAndFollowersAsync({username, password});
    await dynamoDBHandler.getInstance().putTimestampForFunction(username, 'getFollowingAndFollowers');
    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: "Successful run",
        data: {
          numAccountsFollowing: numAccountsFollowing,
          numAccountFollowers: numAccountFollowers,
        }
      })
    };
  } catch(err) {
    console.error(`Error ${err}`);
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
    const latestActivityOfFollowedAccounts = require("./src/getLatestActivityOfAccounts");

    const updateInteractionActivityAsync = async ({username, password}) => {
      return await latestActivityOfFollowedAccounts.getLatestActivityOfAccounts({username, password});
    }

    dynamoDBHandler.createInstance();
    const username = await dynamoDBHandler.getInstance().getNextUserForFunction('updateInteractionActivity');
    if (!username) throw new Error("No username defined for function 'updateInteractionActivity'");

    const password = await dynamoDBHandler.getInstance().getPasswordForUser(username);
    if (!password) throw new Error("No password defined for function 'updateInteractionActivity'");

    const log = await updateInteractionActivityAsync({username, password});
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
    console.error(`Error ${err}`);
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
    const latestMediaOfAccounts = require("./src/getLatestMediaOfAccounts");
    const pendingLikeMediaToQueue = require("./src/addPendingLikeMediaToQueue");

    const addPendingLikeMediaToQueueAsync = async ({username, password}) => {
      console.log(`in addPendingLikeMediaToQueueAsync`);
      const log = await latestMediaOfAccounts.getLatestMediaOfAccounts({username, password});
      console.log(`current log ${JSON.stringify(log)}`);
      log.concat(await pendingLikeMediaToQueue.addPendingLikeMediaToQueue({username, password}));
      console.log(`current log x2 ${JSON.stringify(log)}`);

      return log;
    }

    dynamoDBHandler.createInstance();
    const username = await dynamoDBHandler.getInstance().getNextUserForFunction('addPendingLikeMediaToQueue');
    if (!username) throw new Error("No username defined for function 'addPendingLikeMediaToQueue'");

    const password = await dynamoDBHandler.getInstance().getPasswordForUser(username);
    if (!password) throw new Error("No password defined for function 'addPendingLikeMediaToQueue'");

    const log = await addPendingLikeMediaToQueueAsync({username, password});
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
    console.error(`Error ${err}`);
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
    const {username} = await getSetupVars(event, callback);
    const config = require(`./config.${username}.json`);

    const likedMedia = require("./src/updateLikedMedia");

    const updateLikedMediaAsync = async () => {
      return await likedMedia.updateLikedMedia(config, constants.settings.DATABASE_OBJECT);
    }

    dynamoDBHandler.createInstance();

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
    console.error(`Error ${err}`);
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
