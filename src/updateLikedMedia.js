const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');

const sessionSingleton = require("./services/sessionSingleton");

const MIN_DELAY = 2000;
const MAX_DELAY = 10000;
const MAX_RUNTIME = 200000

const likeMedia = (session, account, db) => {
  console.log(`Liking ${account.username}\t(${account.instagramId})\t${account.mediaUrl} at ${moment()}`)
  return [
    new Client.Like.create(session, account.mediaId),
    db.handler.getInstance().updateLastInteration(account.instagramId, moment().valueOf()),
    db.handler.getInstance().deleteMediaFromPendingTable(account.instagramId, account.mediaId),
  ];
}

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

exports.updateLikedMedia = async (config, db) => {
  const [session, mediaToBeLiked] = await Promise.all([
    sessionSingleton.session.createSession(config),
    db.handler.getInstance().getLatestMediaFromPendingTable(),
  ]);
  if (!mediaToBeLiked.length) {
    console.log("No interactions required");
    return Promise.resolve()
  }

  console.log("Bot will like the following accounts");
  mediaToBeLiked.forEach(media =>
    console.log(`${media.username}\t(${media.instagramId})\t${media.mediaUrl}`)
  );
  let nextRun = 0;
  let totalRunTime = 0;
  console.log();
  return Promise.mapSeries(_.shuffle(mediaToBeLiked), mediaToBeInteractedWith => {
    nextRun = getRandomInt(MIN_DELAY, MAX_DELAY);
    totalRunTime += nextRun;
    if (totalRunTime > MAX_RUNTIME) {
      console.log(`Timing out at ${totalRunTime}ms`);
      return Promise.resolve();
    }
    return Promise.delay(nextRun).then(() => likeMedia(session, mediaToBeInteractedWith, db));
  });
}
