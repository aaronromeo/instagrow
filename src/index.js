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
  .command('likeMedia <username>')
  .alias('l')
  .description('Create "like" interactions')
  .action((username) => {
    const config = require(`../config.${username}.json`);
    const databaseService = require("./services/database");
    const accountsFollowing = require("./getAccountsFollowing");
    const latestMediaOfFollowedAccounts = require("./getLatestMediaOfFollowedAccounts");
    const likedMedia = require("./updateLikedMedia");

    databaseService.handler.createInstance(config);
    accountsFollowing.getAccountsFollowing(config)
      .then(() => latestMediaOfFollowedAccounts.getLatestMediaOfFollowedAccounts(config))
      .then(() => likedMedia.updateLikedMedia(config))
      .finally(() => databaseService.handler.getInstance().close());
  });

commander.parse(process.argv);
