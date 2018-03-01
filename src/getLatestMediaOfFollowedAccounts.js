const Client = require('instagram-private-api').V1;
const _ = require('lodash');
const sessionSingleton = require("./services/sessionSingleton");

const accountsFollowing = require("../data/accounts-following.json");

sessionSingleton.getSession
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
