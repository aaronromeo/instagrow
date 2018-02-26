const Client = require('instagram-private-api').V1;
const _ = require('lodash');
const fs = require('fs');
const config = require("../config.json");

const device = new Client.Device(config.username);
const storage = new Client.CookieFileStorage(__dirname + `/../cookies/${config.username}.json`);

Client.Session.create(device, storage, config.username, config.password)
  .then((session) => {
    return session
  })
  .then((session) => {
    return [session, session.getAccountId()];
  })
  .spread((session, accountId) => {
    return [session, new Client.Feed.AccountFollowing(session, accountId)];
  })
  .spread((session, feed) => {
    return [session, feed.get()];
  })
  .spread(function(session, followingResults) {
    const users = followingResults.map(user => {
      return {id: user.id, username: user._params.username};
    });
    fs.writeFile("data/accounts-following.json", JSON.stringify(users), err => {
      if (err) throw err;

      console.log("List of Accounts followed successfully saved!");
    });
  })
