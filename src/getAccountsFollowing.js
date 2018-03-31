const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const dynamoDBHandler = require("./services/dynamodb").handler;
const sessionSingleton = require("./services/sessionSingleton");

exports.getAccountsFollowing = async ({username, password}) => {
  await dynamoDBHandler.getInstance().updateFollowingAccountsToInactive(username);
  const session = await sessionSingleton.session.createSession({username, password});
  const accountId = await session.getAccountId();
  const feed = await new Client.Feed.AccountFollowing(session, accountId);
  const followingResults = await feed.get();

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
