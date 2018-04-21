const Client = require('instagram-private-api').V1;
const dynamoDBHandler = require("./services/dynamodb").handler;
const sessionSingleton = require("./services/sessionSingleton");
const compareCachedToFetched = require("./utils/compareCachedToFetched");

const getFollowers = async (session, accountId) => {
  try {
    const feed = new Client.Feed.AccountFollowers(session, accountId);
    return await feed.all();
  } catch (err) {
    console.error(`Unable to fetch accounts from Instagram ${err}`);
    throw err;
  }
};

module.exports = async ({username, password}) => {
  const session = await sessionSingleton.session.createSession({username, password});
  const accountId = await session.getAccountId();
  const followersResults = await getFollowers(session, accountId);

  console.log(`Found follower ${followersResults.length} accounts`);
  const cachedFollowersAccounts = await dynamoDBHandler.getInstance().getFollowers(username);

  const updatedUsers = compareCachedToFetched(cachedFollowersAccounts, followersResults);
  await updatedUsers.forEach(async (user) => {
    await dynamoDBHandler.getInstance().addFollowersAccountOrUpdateUsername(username, user.instagramId, user.username, user.isActive)
  })
  console.log(`List of Accounts followers successfully saved for ${updatedUsers.length} accounts`);
}