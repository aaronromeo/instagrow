const accountsFollowing = require("./getAccountsFollowing");
const latestMediaOfFollowedAccounts = require("./getLatestMediaOfFollowedAccounts");
const likedMedia = require("./updateLikedMedia");
const databaseService = require("./services/database");

accountsFollowing.getAccountsFollowing()
  .then(() => latestMediaOfFollowedAccounts.getLatestMediaOfFollowedAccounts())
  .then(() => likedMedia.updateLikedMedia())
  .finally(() => databaseService.handler.close());
