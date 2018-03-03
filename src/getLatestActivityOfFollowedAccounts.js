const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");
const sqliteService = require("./services/sqlite");

const getNextSelfLikedInteraction = (selfLiked, lastInteraction, interactions) => {
  return selfLiked.get().then((selfLikedActivities) => {
    const found = selfLikedActivities.find((activity) => {
      if (activity._params.id === lastInteraction.latestMediaId) {
        return true;
      }
      interactions.push(activity);
    });
    if (found) {
      return interactions;
    }
    if (!selfLiked.isMoreAvailable()) return interactions;
    return getNextSelfLikedInteraction(selfLiked, lastInteraction, interactions);
  });
}

const getSelfLikedUptoLastInteraction = (session, lastInteraction) => {
  const selfLiked = new Client.Feed.SelfLiked(session);
  const interactions = [];

  return getNextSelfLikedInteraction(selfLiked, lastInteraction, interactions);
}

exports.getLatestActivityOfFollowedAccounts = (config) => sessionSingleton.session.createSession(config)
  .then((session) => {
    const lastInteraction = sqliteService.handler.getInstance().getMediaWithLastInteraction();
    return [session, lastInteraction];
  })
  .spread((session, lastInteraction) => {
    if (!lastInteraction) { throw "No interactions logged"; }
    console.log(`Last interaction is for ${lastInteraction.username} on ${lastInteraction.latestMediaUrl} ${lastInteraction.latestMediaId}`);
    return [getSelfLikedUptoLastInteraction(session, lastInteraction), lastInteraction];
  })
  .spread((interactions, lastInteraction) => {
    if (!interactions.length) {console.log("No interactions to update");}
    else {
      console.log(`Updating ${interactions.length} interactions \n`);
    }
    return Promise.map(interactions.reverse(), (interaction) => {
      return sqliteService.handler.getInstance().getAccountByInstagramId(interaction._params.user.pk)
              .then((account) => {
                lastInteraction = lastInteraction > interaction._params.takenAt ? lastInteraction : interaction._params.takenAt;
                if (account) {
                  console.log(`Updating ${interaction._params.user.username} (${interaction._params.user.pk}) interactions from ${account.lastInteractionAt} to ${lastInteraction}`);
                  return Promise.all([
                    sqliteService.handler.getInstance().updateLatestMediaDetails(
                      interaction._params.user.pk,
                      interaction._params.id,
                      interaction._params.webLink,
                      interaction._params.takenAt,
                    ),
                    sqliteService.handler.getInstance().updateLastInteration(
                      interaction._params.user.pk,
                      lastInteraction,
                    ),
                  ]);
                } else {
                  console.log(`Not following ${interaction._params.user.username} (${interaction._params.user.pk})`);
                }
              });
    });
  })
