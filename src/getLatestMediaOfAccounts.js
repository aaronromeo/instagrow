const Client = require('instagram-private-api').V1;
const _ = require('lodash');
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");

exports.getLatestMediaOfAccounts = async (config, db) => {
  const [ session, accountsRelated] = await Promise.all([
    sessionSingleton.session.createSession(config),
    db.handler.getInstance().getAccountsPossiblyRequiringInteraction(),
  ]);

  const accountsRelatedUserMedia = await Promise.map(accountsRelated, async accountFollowing => {
    return new Client.Feed.UserMedia(session, accountFollowing.instagramId, 1);
  })

  let usersMedia = await Promise.map(accountsRelatedUserMedia, latestUserMedia => {
    return latestUserMedia.get()
      .catch(e => {
        console.log(`${e.message} trying to retrieve ${latestUserMedia.accountId}`)
      });
  });

  usersMedia = await Promise.map(_.compact(usersMedia), medias => {
    if (!medias.length === 0 || !medias[0] || !medias[0]._params) {
      return null;
    };
    if (medias[0]._params.hasLiked) {
      return Promise.all([
        db.handler.getInstance().updateLatestMediaDetails(
          medias[0]._params.user.pk,
          medias[0]._params.id,
          medias[0]._params.webLink,
          medias[0]._params.takenAt,
        ),
        db.handler.getInstance().updateLastInteration(
          medias[0]._params.user.pk,
          medias[0]._params.takenAt,
        ),
      ]);
    } else {
      return db.handler.getInstance().updateLatestMediaDetails(
        medias[0]._params.user.pk,
        medias[0]._params.id,
        medias[0]._params.webLink,
        medias[0]._params.takenAt,
      )
    }
  });

  console.log(`Account media followed successfully saved for ${usersMedia.length} accounts!`);
  return Promise.resolve();
}