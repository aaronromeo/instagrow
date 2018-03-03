const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');

const sessionSingleton = require("./services/sessionSingleton");
const sqliteService = require("./services/sqlite");

const MIN_DELAY = 2000;
const MAX_DELAY = 10000;

const likeMedia = (session, account) => {
  console.log(`Liking ${account.username}\t(${account.instagramId})\t${account.latestMediaUrl} at ${moment()}`)
  return [
    new Client.Like.create(session, account.latestMediaId),
<<<<<<< HEAD
    databaseService.handler.getInstance().updateLastInteration(account.instagramId, moment().valueOf())
=======
    sqliteService.handler.updateLastInteration(account.instagramId, moment().valueOf())
>>>>>>> f810d70... WIP: Moving to dynamodb
  ];
}

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

exports.updateLikedMedia = (config) => sessionSingleton.session.createSession(config)
  .then((session) => {
<<<<<<< HEAD
    const accountsToBeLiked = databaseService.handler.getInstance().getAccountsToBeLiked();
=======
    const accountsToBeLiked = sqliteService.handler.getAccountsToBeLiked();
>>>>>>> f810d70... WIP: Moving to dynamodb
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
      nextRun = getRandomInt(MIN_DELAY, MAX_DELAY);
      return Promise.delay(nextRun).then(() => likeMedia(session, accountToBeInteractedWith));
    });
  })
