const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const _ = require('lodash');
const dynamoDBHandler = require("./services/dynamodb").handler;
const moment = require('moment');

const sessionSingleton = require("./services/sessionSingleton");
//
const MIN_DELAY = 2000;
const MAX_DELAY = 10000;
const MAX_RUNTIME = 100000;

const likeMedia = async (username, session, account) => {
  console.log(`Liking ${account.followingUsername}\t(${account.instagramId})\t${account.mediaUrl} at ${moment()}`);
  await new Client.Like.create(session, account.mediaId);
  await dynamoDBHandler.getInstance().updateLastInteration(username, account.instagramId, moment().valueOf());
  return `Liking ${account.followingUsername} ${account.mediaUrl} at ${moment()}`;
}

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

exports.updateLikedMedia = async ({username, password}) => {
  const [session, chunkedShuffledMediaBlock] = await Promise.all([
    sessionSingleton.session.createSession({username, password}),
    dynamoDBHandler.getInstance().getLatestMediaBlockFromPendingTable(username),
  ]);
  const log = [];

  if (!chunkedShuffledMediaBlock.length) {
    console.log("No interactions required");
    log.push("No interactions required");
    return log
  }

  console.log("Bot will like the following accounts");
  log.push("Bot will like the following accounts");
  chunkedShuffledMediaBlock.block.forEach(media => {
    console.log(`${media.followingUsername}\t(${media.instagramId})\t${media.mediaUrl}`);
    // log.push(`${media.followingUsername}\t(${media.instagramId})\t${media.mediaUrl}`);
  });
  let nextRun = 0;
  let totalRunTime = 0;
  console.log();
  await Promise.mapSeries(_.shuffle(chunkedShuffledMediaBlock.block), async (mediaToBeInteractedWith) => {
    if (totalRunTime > MAX_RUNTIME) return log;
    nextRun = getRandomInt(MIN_DELAY, MAX_DELAY);
    totalRunTime += nextRun;
    if (totalRunTime > MAX_RUNTIME) {
      console.log(`Timing out at ${totalRunTime}ms`);
      log.push(`Timing out at ${totalRunTime}ms`);
      return log;
    }
    await Promise.delay(nextRun)
    const message = await likeMedia(username, session, mediaToBeInteractedWith);
    log.push(message);
    return log;
  });
  await dynamoDBHandler.getInstance().deleteMediaBlockFromPendingTable(username, chunkedShuffledMediaBlock.id);

  return log;
}
