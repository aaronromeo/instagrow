const Client = require('instagram-private-api').V1;
const _ = require('lodash');
const dynamoDBHandler = require("./services/dynamodb").handler;
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");

module.exports = async ({username, password}) => {
  const [session, accountsRelated] = await Promise.all([
    sessionSingleton.session.createSession({username, password}),
    dynamoDBHandler.getInstance().getAccountsPossiblyRequiringInteraction(username),
  ]);
  const log = [];

  const accountsRelatedUserMedia = accountsRelated.map((accountFollowing) => {
    return new Client.Feed.UserMedia(session, accountFollowing.instagramId, 1);
  })

  let usersMedia = await Promise.mapSeries(accountsRelatedUserMedia, async latestUserMedia => {
    try {
      return await latestUserMedia.get();
    } catch(e) {
      log.push(`${e.message} trying to retrieve ${latestUserMedia.accountId}`);
      console.log(`${e.message} trying to retrieve ${latestUserMedia.accountId}`);
      return null;
    };
  });

  usersMedia = await Promise.mapSeries(_.compact(usersMedia), async medias => {
    if (!medias.length === 0 || !medias[0] || !medias[0]._params) {
      return null;
    };
    if (medias[0]._params.hasLiked) {
      return await Promise.all([
        dynamoDBHandler.getInstance().updateLatestMediaDetails(
          username,
          medias[0]._params.user.pk,
          medias[0]._params.id,
          medias[0]._params.webLink,
          medias[0]._params.takenAt,
        ),
        dynamoDBHandler.getInstance().updateLastInteration(
          username,
          medias[0]._params.user.pk,
          medias[0]._params.takenAt,
        ),
      ]);
    } else {
      return await dynamoDBHandler.getInstance().updateLatestMediaDetails(
        username,
        medias[0]._params.user.pk,
        medias[0]._params.id,
        medias[0]._params.webLink,
        medias[0]._params.takenAt,
      )
    }
  });

  log.push(`Account media followed successfully saved for ${usersMedia.length} accounts!`);
  console.log(`Account media followed successfully saved for ${usersMedia.length} accounts!`);
  return log;
}