var Client = require('instagram-private-api').V1;
var _ = require('lodash');
var fs = require('fs');
var config = require("../config.json");

var accountsFollowing = require("../data/accounts-following.json");

var device = new Client.Device(config.username);
var storage = new Client.CookieFileStorage(__dirname + `/../cookies/${config.username}.json`);

Client.Session.create(device, storage, config.username, config.password)
  .then((session) => {
    return session
  })
  .then((session) => {
    const accountsFollowingUserMedia = accountsFollowing.map(accountFollowing => {
      return new Client.Feed.UserMedia(session, accountFollowing.id, 5);
    })
    return [session, accountsFollowingUserMedia];
  })
  .spread((session, accountsFollowingUserMedia) => {
    const accountsFollowingUserMediaPromises = accountsFollowingUserMedia.map(latestUserMedia => {
      return latestUserMedia.get();
    });
    return Promise.all(accountsFollowingUserMediaPromises);
  })
  .then(usersMedia => {
    console.log(usersMedia.map(medias => medias[0]));
  })
