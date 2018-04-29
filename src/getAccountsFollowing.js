const Client = require('instagram-private-api').V1;
const dynamoDBHandler = require("./services/dynamodb").handler;
const sessionSingleton = require("./services/sessionSingleton");
const compareCachedToFetched = require("./utils/compareCachedToFetched");

const getFollowing = async (session, accountId) => {
  try {
    const feed = new Client.Feed.AccountFollowing(session, accountId);
    return await feed.all();
  } catch (err) {
    console.error(`Unable to fetch accounts from Instagram ${err}`);
    throw err;
  }
}

module.exports = async ({username, password}) => {
  const session = await sessionSingleton.session.createSession({username, password});
  const accountId = await session.getAccountId();
  const followingResults = await getFollowing(session, accountId);

  if (session._device.username !== username) throw new Error(`Session ${session._device.username} does not match the ${username}`);

  console.log(`Found following ${followingResults.length} accounts`);
  const cachedFollowingAccounts = await dynamoDBHandler.getInstance().getFollowing(username);

  const updatedUsers = compareCachedToFetched(cachedFollowingAccounts, followingResults);
  await updatedUsers.forEach(async (user) => {
    await dynamoDBHandler.getInstance().addFollowingAccountOrUpdateUsername(username, user.instagramId, user.username, user.isActive)
  })
  console.log(`List of Accounts following successfully saved for ${updatedUsers.length} accounts`);
}
