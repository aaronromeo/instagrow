require('dotenv').config();
const Promise = require('bluebird');
const constants = require("./src/constants");
const dynamoDBHandler = require("./src/services/dynamodb").handler;
const getLatestMediaOfAccounts = require("./src/getLatestMediaOfAccounts");
const addPendingLikeMediaToQueue = require("./src/addPendingLikeMediaToQueue");
const getAccountFollowers = require("./src/getAccountFollowers");
const getAccountsFollowing = require("./src/getAccountsFollowing");
const getLatestActivityOfAccounts = require("./src/getLatestActivityOfAccounts");
const updateLikedMedia = require("./src/updateLikedMedia");

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
    return callback(null, response);
  } catch(err) {
    console.error(err);
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
    callback(response);
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
    await dynamoDBHandler.getInstance().createAccountDB(username);
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
    return callback(null, response);
  } catch(err) {
    console.error(err);
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
    return callback(response);
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
    return callback(null, response);
  } catch(err) {
    console.error(err);
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
    return callback(response);
  }
};

module.exports.getFollowers = async (event, context, callback) => {
  let response = {};
  try {
    const getFollowersAsync = async ({username, password}) => {
      const numAccountFollowers = await getAccountFollowers({username, password});
      return numAccountFollowers;
    }

    dynamoDBHandler.createInstance();
    const username = await dynamoDBHandler.getInstance().getNextUserForFunction('getFollowers');
    if (!username) throw new Error("No username defined for function 'getFollowers'");

    const password = await dynamoDBHandler.getInstance().getPasswordForUser(username);
    if (!password) throw new Error("No password defined for function 'getFollowers'");

    await dynamoDBHandler.getInstance().putTimestampForFunction(username, 'getFollowers');
    const numAccountFollowers = await getFollowersAsync({username, password});
    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: "Successful run",
        data: {
          numAccountFollowers: numAccountFollowers,
        }
      })
    };
    return callback(null, response);
  } catch(err) {
    console.error(err);
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
    return callback(response);
  }
};

module.exports.getFollowing = async (event, context, callback) => {
  let response = {};
  try {
    const getFollowingAsync = async ({username, password}) => {
      const numAccountsFollowing = await getAccountsFollowing({username, password});
      return numAccountsFollowing;
    }

    dynamoDBHandler.createInstance();
    const username = await dynamoDBHandler.getInstance().getNextUserForFunction('getFollowing');
    if (!username) throw new Error("No username defined for function 'getFollowing'");

    const password = await dynamoDBHandler.getInstance().getPasswordForUser(username);
    if (!password) throw new Error("No password defined for function 'getFollowing'");

    await dynamoDBHandler.getInstance().putTimestampForFunction(username, 'getFollowing');
    const numAccountsFollowing = await getFollowingAsync({username, password});
    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: "Successful run",
        data: {
          numAccountsFollowing: numAccountsFollowing,
        }
      })
    };
    return callback(null, response);
  } catch(err) {
    console.error(err);
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
    return callback(response);
  }
};

module.exports.updateInteractionActivity = async (event, context, callback) => {
  let response = {};
  try {
    const updateInteractionActivityAsync = async ({username, password}) => {
      return await getLatestActivityOfAccounts({username, password});
    }

    dynamoDBHandler.createInstance();
    const username = await dynamoDBHandler.getInstance().getNextUserForFunction('updateInteractionActivity');
    if (!username) throw new Error("No username defined for function 'updateInteractionActivity'");

    const password = await dynamoDBHandler.getInstance().getPasswordForUser(username);
    if (!password) throw new Error("No password defined for function 'updateInteractionActivity'");

    await dynamoDBHandler.getInstance().putTimestampForFunction(username, 'updateInteractionActivity');
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
    return callback(null, response);
  } catch(err) {
    console.error(err);
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
    return callback(response);
  }
};

module.exports.getLatestMediaOfAccounts = async (event, context, callback) => {
  let response = {};
  const addPendingLikeMediaToQueueAsync = async ({username, password}) => {
    return await getLatestMediaOfAccounts({username, password});
  }

  try {
    dynamoDBHandler.createInstance();
    const username = await dynamoDBHandler.getInstance().getNextUserForFunction('getLatestMediaOfAccounts');
    if (!username) throw new Error("No username defined for function 'getLatestMediaOfAccounts'");

    const password = await dynamoDBHandler.getInstance().getPasswordForUser(username);
    if (!password) throw new Error("No password defined for function 'getLatestMediaOfAccounts'");

    await dynamoDBHandler.getInstance().putTimestampForFunction(username, 'getLatestMediaOfAccounts');
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
    return callback(null, response);
  } catch(err) {
    console.error(err);
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
    return callback(response);
  }
};

module.exports.queuePendingLikeMedia = async (event, context, callback) => {
  let response = {};
  const addPendingLikeMediaToQueueAsync = async ({username, password}) => {
    return await addPendingLikeMediaToQueue({username});
  }

  try {
    dynamoDBHandler.createInstance();
    const username = await dynamoDBHandler.getInstance().getNextUserForFunction('queuePendingLikeMedia');
    if (!username) throw new Error("No username defined for function 'queuePendingLikeMedia'");

    const password = await dynamoDBHandler.getInstance().getPasswordForUser(username);
    if (!password) throw new Error("No password defined for function 'queuePendingLikeMedia'");

    await dynamoDBHandler.getInstance().putTimestampForFunction(username, 'queuePendingLikeMedia');
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
    return callback(null, response);
  } catch(err) {
    console.error(err);
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
    return callback(response);
  }
};

module.exports.updateLikedMedia = async (event, context, callback) => {
  let response = {};
  try {
    const updateLikedMediaAsync = async ({username, password}) => {
      return await updateLikedMedia({username, password});
    }

    dynamoDBHandler.createInstance();
    const username = await dynamoDBHandler.getInstance().getNextUserForFunction('updateLikedMedia');
    if (!username) throw new Error("No username defined for function 'updateLikedMedia'");

    const password = await dynamoDBHandler.getInstance().getPasswordForUser(username);
    if (!password) throw new Error("No password defined for function 'updateLikedMedia'");

    await dynamoDBHandler.getInstance().putTimestampForFunction(username, 'updateLikedMedia');
    const log = await updateLikedMediaAsync({username, password});
    response = {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successful run`,
        data: {
          log: log,
        }
      })
    };
    return callback(null, response);
  } catch(err) {
    console.error(err);
    response = {
      statusCode: 400,
      body: JSON.stringify({
        message: err,
      }),
    };
    return callback(response);
  }
};
