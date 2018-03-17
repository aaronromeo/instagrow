const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');

const sessionSingleton = require("./services/sessionSingleton");

exports.addPendingLikeMediaToQueue = (config, db) => sessionSingleton.session.createSession(config)
  .then((session) => {
    const accountsRelated = db.handler.getInstance().getAccountsToBeLiked();
    return [session, accountsRelated]
  })
  .spread((session, accountsRelated) => {
    if (accountsRelated.length) {
      console.log();
      console.log("Bot will add the following accounts to the queue");
      accountsRelated.forEach(account =>
        console.log(`${account.username}\t(${account.instagramId})\t${account.latestMediaUrl}`)
      );
    }
    console.log();
    return Promise.mapSeries(_.shuffle(accountsRelated), accountToBeInteractedWith => {
      return db.handler.getInstance().addLatestMediaToPendingTable(
        accountToBeInteractedWith.instagramId,
        accountToBeInteractedWith.latestMediaId,
        accountToBeInteractedWith.latestMediaUrl,
        accountToBeInteractedWith.username,
      )
    });
  })
