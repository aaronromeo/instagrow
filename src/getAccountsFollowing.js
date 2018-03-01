const Client = require('instagram-private-api').V1;
const _ = require('lodash');
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");
const databaseService = require("./services/database");


const addAccountIfNull = (user) => {
  return databaseService.handler.getAccountByInstagramId(user.id)
  .then((row) => {
    if (!row || row===undefined) {
      return databaseService.handler.addAccount(user.id, user._params.username);
    } else return row;
  })
}

sessionSingleton.getSession
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
    return Promise.map(followingResults, user => addAccountIfNull(user));
  })
  .then((accountRows) => {
    accountRows.forEach(account => console.log(account));
    databaseService.handler.close();
    console.log("List of Accounts followed successfully saved!");
  })

