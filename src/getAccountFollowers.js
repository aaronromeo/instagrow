const Client = require('instagram-private-api').V1;
const dynamoDBHandler = require("./services/dynamodb").handler;
const sessionSingleton = require("./services/sessionSingleton");

const getFollowers = async (session, accountId) => {
  try {
    const feed = new Client.Feed.AccountFollowers(session, accountId);
    return await feed.get();
  } catch (err) {
    console.error(`Unable to fetch accounts from Instagram ${err}`);
    throw err;
  }
};

const compareCachedToFetched = (cachedUsers, fetchedUsers) => {
  const formattedFetchedUsers = fetchedUsers.map(user => ({instagramId: user.id, username: user._params.username, isActive: true}));
  const formattedCachedUsers = cachedUsers.map(user => ({instagramId: user.instagramId, username: user._params.username, isActive: true}));

  const updatedUsers = formattedFetchedUsers.reduce((accumulator, fetchedUser) => {
    const cachedUser = formattedCachedUsers.find((c) => c.instagramId === fetchedUser.instagramId);
    if (!cachedUser) {
      fetchedUser["isActive"] = true
      accumulator.push(fetchedUser);
    } else if (cachedUser) {
      if (cachedUser.username !== fetchedUser.username) {
        fetchedUser["isActive"] = true
        accumulator.push(fetchedUser);
      }
    }
    return accumulator;
  }, []);

  const inactiveUsers = formattedCachedUsers.filter((c) => !formattedFetchedUsers.find((f) => {c.instagramId === f.instagramId}));
  inactiveUsers.forEach(inactiveUser => inactiveUser["isActive"] = false);

  updatedUsers.concat(inactiveUsers);
  return updatedUsers;
}

module.exports = async ({username, password}) => {
  // await dynamoDBHandler.getInstance().updateFollowerAccountsToInactive(username);
  const session = await sessionSingleton.session.createSession({username, password});
  const accountId = await session.getAccountId();
  const followersResults = await getFollowers(session, accountId);

  console.log(`Found follower ${followersResults.length} accounts`);
  const cachedFollowersAccounts = await dynamoDBHandler.getInstance().getFollowers(username);

  console.log(compareCachedToFetched(cachedFollowersAccounts, followersResults));

  // const accountRows = await dynamoDBHandler.getInstance().addFollowersAccountOrUpdateUsernameBatch(username, followersResults);
  // const badAccounts = accountRows.filter(account => !account);
  // if (!badAccounts.length) {
  //   console.log(`List of Accounts followers successfully saved for ${accountRows.length} accounts`);
  //   return accountRows.length;
  // } else {
  //   console.error(`Error saving accounts ${badAccounts}`);
  //   throw new Error(`Error saving accounts ${badAccounts}`);
  // }
}