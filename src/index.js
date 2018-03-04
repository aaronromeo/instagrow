const accountsFollowing = require("./getAccountsFollowing");
const latestMediaOfFollowedAccounts = require("./getLatestMediaOfFollowedAccounts");
const likedMedia = require("./updateLikedMedia");
const databaseService = require("./services/database");
const config = require("../config.json");

databaseService.handler.createInstance(config);

accountsFollowing.getAccountsFollowing()
  .then(() => latestMediaOfFollowedAccounts.getLatestMediaOfFollowedAccounts())
  .then(() => likedMedia.updateLikedMedia())
  .finally(() => databaseService.handler.getInstance().close());
