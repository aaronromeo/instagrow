var Client = require('instagram-private-api').V1;
var _ = require('lodash');
var config = require("../config.json");

var device = new Client.Device(config.username);
var storage = new Client.CookieFileStorage(__dirname + `/../cookies/${config.username}.json`);

Client.Session.create(device, storage, config.username, config.password)
  .then(function(session) {
    return session
  })
  .then(function(session) {
    return [session, session.getAccountId()];
  })
  .spread(function(session, accountId) {
    return new Client.Feed.AccountFollowing(session, accountId);
  })
  .then(function(feed) {
    return feed.get();
  })
  .then(function(results) {
    console.log(results);
  })
