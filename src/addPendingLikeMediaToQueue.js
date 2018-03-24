const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment');

const sessionSingleton = require("./services/sessionSingleton");

exports.addPendingLikeMediaToQueue = async (config, db) => {
  const [session, accountsRelated] = await Promise.all([
    sessionSingleton.session.createSession(config),
    db.handler.getInstance().getAccountsToBeLiked(),
  ]);

  const log = [];
  if (accountsRelated.length) {
    console.log();
    console.log("Bot will add the following accounts to the queue");
    log.push("Bot will add the following accounts to the queue");
    accountsRelated.forEach(account => {
      console.log(`${account.username}\t(${account.instagramId})\t${account.latestMediaUrl}`);
      log.push(`${account.username}\t(${account.instagramId})\t${account.latestMediaUrl}`);
    });
  }
  console.log();
  await Promise.mapSeries(_.shuffle(accountsRelated), accountToBeInteractedWith => {
    return db.handler.getInstance().addLatestMediaToPendingTable(
      accountToBeInteractedWith.instagramId,
      accountToBeInteractedWith.latestMediaId,
      accountToBeInteractedWith.latestMediaUrl,
      accountToBeInteractedWith.username,
    )
  });

  return Promise.resolve(log);
}
