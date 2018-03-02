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
    console.log(accountsToBeLiked);
    return Promise.map(accountsToBeLiked, accountToBeInteractedWith => {
      return new Client.Like.create(session, accountToBeInteractedWith.latestMediaId);
    });
  })
