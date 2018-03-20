const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");

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

exports.getLatestActivityOfAccounts = async (config, db) => {
  let [session, lastInteraction] = await Promise.all([
    sessionSingleton.session.createSession(config),
    db.handler.getInstance().getMediaWithLastInteraction(),
  ]);
  const log = [];

  if (!lastInteraction || !lastInteraction.username) {
    console.log("No interactions logged");
    return Promise.resolve("No interactions logged");
  }

  log.push(`Last interaction is for ${lastInteraction.username} on ${lastInteraction.latestMediaUrl} ${lastInteraction.latestMediaId}`)
  console.log(log);
  const interactions = getSelfLikedUptoLastInteraction(session, lastInteraction);

  if (!interactions.length) {
    log.push("No interactions to update");
    console.log("No interactions to update");
    return Promise.resolve(log);
  }
  else {
    console.log(`Updating ${interactions.length} interactions \n`);
    log.push(`Updating ${interactions.length} interactions`);
  }
  await Promise.map(interactions.reverse(), (interaction) => {
    return db.handler.getInstance().getAccountByInstagramId(interaction._params.user.pk)
            .then((account) => {
              lastInteraction = lastInteraction > interaction._params.takenAt ? lastInteraction : interaction._params.takenAt;
              if (account && account.lastInteractionAt < lastInteraction) {
                log.push(`Updating ${interaction._params.user.username} (${interaction._params.user.pk}) interactions from ${account.lastInteractionAt} to ${lastInteraction}`);
                console.log(`Updating ${interaction._params.user.username} (${interaction._params.user.pk}) interactions from ${account.lastInteractionAt} to ${lastInteraction}`);
                return Promise.all([
                  db.handler.getInstance().updateLatestMediaDetails(
                    interaction._params.user.pk,
                    interaction._params.id,
                    interaction._params.webLink,
                    interaction._params.takenAt,
                  ),
                  db.handler.getInstance().updateLastInteration(
                    interaction._params.user.pk,
                    lastInteraction,
                  ),
                ]);
              } else if (account) {
                log.push(`Skipping ${interaction._params.user.username} (${interaction._params.user.pk}) lastInteraction (${account.lastInteractionAt}) is greater than ${lastInteraction}`);
                console.log(`Skipping ${interaction._params.user.username} (${interaction._params.user.pk}) lastInteraction (${account.lastInteractionAt}) is greater than ${lastInteraction}`);
              } else {
                log.push(`Not following ${interaction._params.user.username} (${interaction._params.user.pk})`);
                console.log(`Not following ${interaction._params.user.username} (${interaction._params.user.pk})`);
              }
            });
    });

    return Promise.resolve(log);
  }
