const Client = require('instagram-private-api').V1;
const _ = require('lodash');
const dynamoDBHandler = require("./services/dynamodb").handler;
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");

const getLastLikedMediaTimestamp = (medias) => {
  const likedMedia = medias.filter(media => media._params.hasLiked) || {};
  return likedMedia.length ? likedMedia[0]._params.takenAt : 0;
}

module.exports = async ({username, password}) => {
  const [session, accountsRelated] = await Promise.all([
    sessionSingleton.session.createSession({username, password}),
    dynamoDBHandler.getInstance().getAccountsPossiblyRequiringInteraction(username, 10),
  ]);
  if (session._device.username !== username) throw new Error(`Session ${session._device.username} does not match the ${username}`);

  const log = [];

  let usersMedia = await Promise.mapSeries(accountsRelated, async account => {
    try {
      const userMedia = new Client.Feed.UserMedia(session, account.instagramId, 1);
      dynamoDBHandler.getInstance().updateIsActive(username, account.instagramId, false);
      const medias = await userMedia.get();
      if (!medias.length === 0 || !medias[0] || !medias[0]._params) {
        await dynamoDBHandler.getInstance().updateLatestMediaDetails(
          username,
          account.instagramId,
          null,
          null,
          0,
        )
      } else {
        const lastLikedMediaTimestamp = getLastLikedMediaTimestamp(medias);
        if (lastLikedMediaTimestamp && (!account.lastInteractionAt || account.lastInteractionAt < lastLikedMediaTimestamp)) {
          await Promise.all([
            dynamoDBHandler.getInstance().updateLatestMediaDetails(
              username,
              medias[0]._params.user.pk,
              medias[0]._params.id,
              medias[0]._params.webLink,
              medias[0]._params.takenAt,
            ),
            dynamoDBHandler.getInstance().updateLastInteration(
              username,
              account.instagramId,
              lastLikedMediaTimestamp,
            ),
          ]);
        } else {
          await dynamoDBHandler.getInstance().updateLatestMediaDetails(
            username,
            medias[0]._params.user.pk,
            medias[0]._params.id,
            medias[0]._params.webLink,
            medias[0]._params.takenAt,
          )
        }
      }
      dynamoDBHandler.getInstance().updateIsActive(username, account.instagramId, true);
    } catch(e) {
      log.push(`${e.message} trying to retrieve ${account.instagramId}`);
      console.log(`${e.message} trying to retrieve ${account.instagramId}`);
    };
    return account.instagramId
  });

  log.push(`Account media followed successfully saved for ${usersMedia.length} accounts!`);
  console.log(`Account media followed successfully saved for ${usersMedia.length} accounts!`);
  return log;
}