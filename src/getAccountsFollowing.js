const Client = require('instagram-private-api').V1;
const dynamoDBHandler = require("./services/dynamodb").handler;
const sessionSingleton = require("./services/sessionSingleton");

const getFollowing = async (session, accountId) => {
  try {
    const feed = await new Client.Feed.AccountFollowing(session, accountId);
    return await feed.get();
  } catch (err) {
    console.error(`Unable to fetch accounts from Instagram ${err}`);
    throw err;
  }
}

module.exports = async ({username, password}) => {
  await dynamoDBHandler.getInstance().updateFollowingAccountsToInactive(username);
  const session = await sessionSingleton.session.createSession({username, password});
  const accountId = await session.getAccountId();
  const followingResults = await getFollowing(session, accountId);

  console.log(`Found following ${followingResults.length} accounts`);
  const accountRows = await dynamoDBHandler.getInstance().addFollowingAccountOrUpdateUsernameBatch(username, followingResults);
  const badAccounts = accountRows.filter(account => !account);
  if (!badAccounts.length) {
    console.log(`List of Accounts following successfully saved for ${accountRows.length} accounts`);
    return accountRows.length;
  } else {
    console.error(`Error saving accounts ${badAccounts}`);
    throw new Error(`Error saving accounts ${badAccounts}`);
  }
}
