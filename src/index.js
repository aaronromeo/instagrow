require('dotenv').config()
const commander = require('commander');
const constants = require("./constants");

commander
  .version('0.0.1')
  .description('Instagrow, an Instagram engagement tool');


commander
  .command('createAccountDatabase <username>')
  .alias('c')
  .description('Create and setup a DB and table to store Instagram user activity')
  .action((username) => {
    const config = require(`../config.${username}.json`);

    constants.settings.DATABASE_OBJECT.handler.createInstance(config);
    constants.settings.DATABASE_OBJECT.handler.getInstance().createAccountDB();
  });

commander
  .command('exportFromDynamoDB <username>')
  .alias('ed')
  .description('Export the DynamoDB Instagram database to a file in data/')
  .action((username) => {
    const config = require(`../config.${username}.json`);
    const dynamodbService = require("./services/dynamodb");

    dynamodbService.handler.createInstance(config);
    dynamodbService.handler.getInstance().exportData();
  });

commander
  .command('importIntoDynamoDatabase <username>')
  .alias('id')
  .description('Import into the DynamoDB Instagram database from file in data/')
  .action((username) => {
    const config = require(`../config.${username}.json`);
    const dynamodbService = require("./services/dynamodb");

    dynamodbService.handler.createInstance(config);
    dynamodbService.handler.getInstance().importData();
  });

commander
  .command('deleteDynamoDatabase <username>')
  .alias('dd')
  .description('Delete a DynamoDB Instagram user table to store activity')
  .action((username) => {
    const config = require(`../config.${username}.json`);
    const dynamodbService = require("./services/dynamodb");

    dynamodbService.handler.createInstance(config);
    dynamodbService.handler.getInstance().deleteDB();
  });

commander.parse(process.argv);
