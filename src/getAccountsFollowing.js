const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");

exports.getAccountsFollowing = (config, db) => db.handler.getInstance().updateFollowingAccountsToInactive()
  .then(() => sessionSingleton.session.createSession(config))
  .then((session) => {
    return [session, session.getAccountId()];
  })
  .spread((session, accountId) => {
    return new Client.Feed.AccountFollowing(session, accountId);
  })
  .then((feed) => {
    return feed.get();
  })
  .then((followingResults) => {
    return Promise.map(
      followingResults,
      user => db.handler.getInstance().addFollowingAccountOrUpdateUsername(user.id, user._params.username)
    );
  })
  .then((accountRows) => {
    const badAccounts = accountRows.filter(account => !account);
    if (!badAccounts.length) {
      console.log(`List of Accounts following successfully saved for ${accountRows.length} accounts`);
      return Promise.resolve();
    } else {
      console.log(`Error saving accounts ${badAccounts}`);
      return Promise.reject();
    }
  })
