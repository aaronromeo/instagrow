const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');

const sessionSingleton = require("./services/sessionSingleton");
const databaseService = require("./services/database");

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
    return Promise.map(_.slice(accountsToBeLiked, 0, 30), accountToBeInteractedWith => {
      return new Client.Like.create(session, accountToBeInteractedWith.latestMediaId);
    });
  })
