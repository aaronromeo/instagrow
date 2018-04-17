const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const dynamoDBHandler = require("./services/dynamodb").handler;
const sessionSingleton = require("./services/sessionSingleton");

const getNextSelfLikedInteraction = async (selfLiked, lastInteraction, interactions) => {
  const selfLikedActivities = await selfLiked.get();
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
  return await getNextSelfLikedInteraction(selfLiked, lastInteraction, interactions);
}

const getSelfLikedUptoLastInteraction = async (session, lastInteraction) => {
  const selfLiked = new Client.Feed.SelfLiked(session);
  const interactions = [];

  try{
    return await getNextSelfLikedInteraction(selfLiked, lastInteraction, interactions);
  } catch(err) {
    console.error(JSON.stringify(err));
    throw err;
  }
}

module.exports = async ({username, password}) => {
  let [session, lastInteraction] = await Promise.all([
    sessionSingleton.session.createSession({username, password}),
    dynamoDBHandler.getInstance().getMediaWithLastInteraction(username),
  ]);
  const log = [];

  if (!lastInteraction || !lastInteraction.username) {
    console.log("No interactions logged");
    return "No interactions logged";
  }

  log.push(`Last interaction is for ${lastInteraction.username} on ${lastInteraction.latestMediaUrl} ${lastInteraction.latestMediaId}`)
  console.log(log);
  const interactions = await getSelfLikedUptoLastInteraction(session, lastInteraction);

  if (!interactions.length) {
    log.push("No interactions to update");
    console.log("No interactions to update");
    return log;
  }
  else {
    console.log(`Updating ${interactions.length} interactions \n`);
    log.push(`Updating ${interactions.length} interactions`);
  }
  await Promise.mapSeries(interactions.reverse(), async (interaction) => {
    const account = await dynamoDBHandler.getInstance().getAccountByInstagramId(username, interaction._params.user.pk);
    lastInteraction = lastInteraction > interaction._params.takenAt ? lastInteraction : interaction._params.takenAt;
    if (account && account.lastInteractionAt < lastInteraction) {
      log.push(`Updating ${interaction._params.user.username} (${interaction._params.user.pk}) interactions from ${account.lastInteractionAt} to ${lastInteraction}`);
      console.log(`Updating ${interaction._params.user.username} (${interaction._params.user.pk}) interactions from ${account.lastInteractionAt} to ${lastInteraction}`);
      await Promise.all([
        dynamoDBHandler.getInstance().updateLatestMediaDetails(
          username,
          interaction._params.user.pk,
          interaction._params.id,
          interaction._params.webLink,
          interaction._params.takenAt,
        ),
        dynamoDBHandler.getInstance().updateLastInteration(
          username,
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
    };

    return log;
  });
}
