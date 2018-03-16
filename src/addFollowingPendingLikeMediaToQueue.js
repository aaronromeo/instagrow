const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');

const sessionSingleton = require("./services/sessionSingleton");

exports.addFollowingPendingLikeMediaToQueue = (config, db) => sessionSingleton.session.createSession(config)
  .then((session) => {
    const accountsToBeLiked = db.handler.getInstance().getAccountsToBeLiked();
    return [session, accountsToBeLiked]
  })
  .spread((session, accountsToBeLiked) => {
    if (accountsToBeLiked.length) {
      console.log();
      console.log("Bot will add the following accounts to the queue");
      accountsToBeLiked.forEach(account =>
        console.log(`${account.username}\t(${account.instagramId})\t${account.latestMediaUrl}`)
      );
    }
    console.log();
    return Promise.mapSeries(_.shuffle(accountsToBeLiked), accountToBeInteractedWith => {
      return db.handler.getInstance().addLatestMediaToPendingTable(
        accountToBeInteractedWith.instagramId,
        accountToBeInteractedWith.latestMediaId,
        accountToBeInteractedWith.latestMediaUrl,
        accountToBeInteractedWith.username,
      )
    });
  })
