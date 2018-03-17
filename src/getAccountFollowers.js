const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");

exports.getAccountFollowers = (config, db) => db.handler.getInstance().updateFollowerAccountsToInactive()
  .then(() => sessionSingleton.session.createSession(config))
  .then((session) => {
    return [session, session.getAccountId()];
  })
  .spread((session, accountId) => {
    return new Client.Feed.AccountFollowers(session, accountId);
  })
  .then((feed) => {
    return feed.get();
  })
  .then((followingResults) => {
    return Promise.map(
      followingResults,
      user => db.handler.getInstance().addFollowersAccountOrUpdateUsername(user.id, user._params.username)
    );
  })
  .then((accountRows) => {
    const badAccounts = accountRows.filter(account => !account);
    if (!badAccounts.length) {
      console.log(`List of Accounts followers successfully saved for ${accountRows.length} accounts`);
      return Promise.resolve();
    } else {
      console.log(`Error saving accounts ${badAccounts}`);
      return Promise.reject();
    }
  })
