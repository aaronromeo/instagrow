const Client = require('instagram-private-api').V1;
const _ = require('lodash');
const fs = require('fs');
const config = require("../config.json");

const accountsFollowing = require("../data/accounts-following.json");

const device = new Client.Device(config.username);
const storage = new Client.CookieFileStorage(__dirname + `/../cookies/${config.username}.json`);

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
