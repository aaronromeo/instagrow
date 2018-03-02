const Client = require('instagram-private-api').V1;
const _ = require('lodash');
const moment = require('moment');
const Promise = require('bluebird');
const sessionSingleton = require("./services/sessionSingleton");
const databaseService = require("./services/database");

sessionSingleton.getSession
  .then((session) => {
    const accountsFollowing = databaseService.handler.getAccounts();
    return [session, accountsFollowing]
  })
  .spread((session, accountsFollowing) => {
    const accountsFollowingUserMedia = accountsFollowing.map(accountFollowing => {
      return new Client.Feed.UserMedia(session, accountFollowing.instagramId, 5);
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
    return Promise.map(usersMedia, medias => {
      if (!medias.length === 0 || !medias[0] || !medias[0]._params) {
        console.log(medias);
        return null;
      };
      if (medias[0]._params.hasLiked) {
        return Promise.all([
          databaseService.handler.updateLatestMediaDetails(
            medias[0]._params.user.pk,
            medias[0]._params.id,
            medias[0]._params.webLink,
            moment(medias[0]._params.takenAt).format(),
          ),
          databaseService.handler.updateLastInteration(
            medias[0]._params.user.pk,
            moment(medias[0]._params.takenAt).format(),
          ),
        ]);
      } else {
        return databaseService.handler.updateLatestMediaDetails(
          medias[0]._params.user.pk,
          medias[0]._params.id,
          medias[0]._params.webLink,
          moment(medias[0]._params.takenAt).format(),
        )
      }
    });
  })
  .then(usersMedia => {
    console.log("Account media followed successfully saved!");
  })
  .finally(() => databaseService.handler.close())
