const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const _ = require('lodash');
const dynamoDBHandler = require("./services/dynamodb").handler;
const moment = require('moment');

const sessionSingleton = require("./services/sessionSingleton");

module.exports = async ({username}) => {
  const accountsRelated = await dynamoDBHandler.getInstance().getAccountsToBeLiked(username);

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
  const chunkedShuffledMediaBlocks = _.chunk(_.shuffle(accountsRelated), 10);
  await Promise.mapSeries(chunkedShuffledMediaBlocks, async (chunkedShuffledMediaBlock) => {
    console.log(`Adding block for ${JSON.stringify(chunkedShuffledMediaBlock)}`);
    return await dynamoDBHandler.getInstance().addLatestMediaBlockToPendingTable(
      username,
      chunkedShuffledMediaBlock,
    );
  });

  return log;
}
