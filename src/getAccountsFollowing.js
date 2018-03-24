const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");

exports.getAccountsFollowing = async (config, db) => {
  await db.handler.getInstance().updateFollowingAccountsToInactive();
  const session = await sessionSingleton.session.createSession(config);
  const accountId = await session.getAccountId();
  const feed = await new Client.Feed.AccountFollowing(session, accountId);
  const followingResults = await feed.get();

  const accountRows = await Promise.map(
      followingResults,
      user => db.handler.getInstance().addFollowingAccountOrUpdateUsername(user.id, user._params.username)
    );
  const badAccounts = accountRows.filter(account => !account);
  if (!badAccounts.length) {
    console.log(`List of Accounts following successfully saved for ${accountRows.length} accounts`);
    return Promise.resolve(accountRows.length);
  } else {
    console.error(`Error saving accounts ${badAccounts}`);
    return Promise.reject(`Error saving accounts ${badAccounts}`);
  }
}
