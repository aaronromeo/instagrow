const commander = require('commander');

commander
  .version('0.0.1')
  .description('Instagrow, an Instagram engagement tool');

commander
  .command('createDatabase <username>')
  .alias('c')
  .description('Create an Instagram database to store activity')
  .action((username) => {
    const config = require(`../config.${username}.json`);
    const databaseService = require("./services/database");

    databaseService.handler.createInstance(config);
    databaseService.handler.getInstance().create();
  });

commander
  .command('updateInteractionActivity <username>')
  .alias('uia')
  .description('Checks the users feed and updates the activity')
  .action((username) => {
    const config = require(`../config.${username}.json`);
    const accountsFollowing = require("./getAccountsFollowing");
    const databaseService = require("./services/database");
    const latestActivityOfFollowedAccounts = require("./getLatestActivityOfFollowedAccounts");

    databaseService.handler.createInstance(config);
    accountsFollowing.getAccountsFollowing(config)
      .then(() => latestActivityOfFollowedAccounts.getLatestActivityOfFollowedAccounts(config))
      .finally(() => databaseService.handler.getInstance().close());
  });

commander
  .command('updateFollowersMedia <username>')
  .alias('ufm')
  .description('Update the cached media data of followed accounts who have have not been interacted with in the last 3 days')
  .action((username) => {
    const config = require(`../config.${username}.json`);
    const databaseService = require("./services/database");
    const accountsFollowing = require("./getAccountsFollowing");
    const latestMediaOfFollowedAccounts = require("./getLatestMediaOfFollowedAccounts");

    databaseService.handler.createInstance(config);
    accountsFollowing.getAccountsFollowing(config)
      .then(() => latestMediaOfFollowedAccounts.getLatestMediaOfFollowedAccounts(config))
      .finally(() => databaseService.handler.getInstance().close());
  });

commander
  .command('likeMedia <username>')
  .alias('l')
  .description('Create "like" interactions for followed accounts who have posted content in the last 3-7 days')
  .action((username) => {
    const config = require(`../config.${username}.json`);
    const databaseService = require("./services/database");
    const accountsFollowing = require("./getAccountsFollowing");
    const latestActivityOfFollowedAccounts = require("./getLatestActivityOfFollowedAccounts");
    const latestMediaOfFollowedAccounts = require("./getLatestMediaOfFollowedAccounts");
    const likedMedia = require("./updateLikedMedia");

    databaseService.handler.createInstance(config);
    accountsFollowing.getAccountsFollowing(config)
      .then(() => latestActivityOfFollowedAccounts.getLatestActivityOfFollowedAccounts(config))
      .then(() => latestMediaOfFollowedAccounts.getLatestMediaOfFollowedAccounts(config))
      .then(() => likedMedia.updateLikedMedia(config))
      .finally(() => databaseService.handler.getInstance().close());
  });

commander.parse(process.argv);
