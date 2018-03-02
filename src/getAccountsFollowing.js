const Client = require('instagram-private-api').V1;
const _ = require('lodash');
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");
const databaseService = require("./services/database");

const getAccountsFollowing = sessionSingleton.getSession
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
      user => databaseService.handler.addAccountOrUpdateUsername(user.id, user._params.username)
    );
  })
  .then((accountRows) => {
    accountRows.forEach(account => console.log(account));
    const badAccounts = accountRows.filter(account => !account);
    if (!badAccounts.length) {
      console.log("List of Accounts followed successfully saved!");
    } else {
      console.log(`Error saving accounts ${badAccounts}`);
    }
  })
  .finally(() => databaseService.handler.close())

exports.instagrow = {
  getAccountsFollowing,
};
