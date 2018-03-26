const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const dynamoDBHandler = require("./services/dynamodb").handler;
const sessionSingleton = require("./services/sessionSingleton");

exports.getAccountFollowers = async ({username, password}) => {
  await dynamoDBHandler.getInstance().updateFollowerAccountsToInactive(username);
  const session = await sessionSingleton.session.createSession({username, password});
  const accountId = await session.getAccountId();
  const feed = await new Client.Feed.AccountFollowers(session, accountId);
  const followersResults = await feed.get();

  const accountRows = await followersResults.map((user) =>{
    return dynamoDBHandler.getInstance().addFollowersAccountOrUpdateUsername(username, user.id, user._params.username)
  });
 const badAccounts = accountRows.filter(account => !account);
  if (!badAccounts.length) {
    console.log(`List of Accounts followers successfully saved for ${accountRows.length} accounts`);
    return Promise.resolve(accountRows.length);
  } else {
    console.error(`Error saving accounts ${badAccounts}`);
    return Promise.reject(`Error saving accounts ${badAccounts}`);
  }
}