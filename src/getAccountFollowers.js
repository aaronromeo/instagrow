const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");

exports.getAccountFollowers = async (config, db) => {
  await db.handler.getInstance().updateFollowerAccountsToInactive();
  const session = await sessionSingleton.session.createSession(config);
  const accountId = await session.getAccountId();
  const feed = await new Client.Feed.AccountFollowers(session, accountId);
  const followersResults = await feed.get();

  const accountRows = await Promise.map(
      followersResults,
      user => db.handler.getInstance().addFollowersAccountOrUpdateUsername(user.id, user._params.username)
    );
  const badAccounts = accountRows.filter(account => !account);
  if (!badAccounts.length) {
    console.log(`List of Accounts followers successfully saved for ${accountRows.length} accounts`);
    return Promise.resolve(accountRows.length);
  } else {
    console.log(`Error saving accounts ${badAccounts}`);
    return Promise.reject();
  }
}