const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');

const sessionSingleton = require("./services/sessionSingleton");
const databaseService = require("./services/database");

const MAX_EXECUTION_TIME = 200000;

const likeMedia = (session, account) => {
  console.log(`Liking ${account.username}\t(${account.instagramId})\t${account.latestMediaUrl} at ${moment()}`)
  return [
    new Client.Like.create(session, account.latestMediaId),
    databaseService.handler.updateLastInteration(account.instagramId, moment().valueOf())
  ];
}

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

exports.updateLikedMedia = () => sessionSingleton.getSession
  .then((session) => {
    const accountsToBeLiked = databaseService.handler.getAccountsToBeLiked();
    return [session, accountsToBeLiked]
  })
  .spread((session, accountsToBeLiked) => {
    if (accountsToBeLiked.length) {
      console.log("Bot will like the following accounts");
      accountsToBeLiked.forEach(account =>
        console.log(`${account.username}\t(${account.instagramId})\t${account.latestMediaUrl}`)
      );
    }
    let nextRun = 0;
    console.log();
    return Promise.mapSeries(_.shuffle(accountsToBeLiked), accountToBeInteractedWith => {
      nextRun = getRandomInt(2000, 10000);
      return Promise.delay(nextRun).then(() => likeMedia(session, accountToBeInteractedWith));
    });
  })
