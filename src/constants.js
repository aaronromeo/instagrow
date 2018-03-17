const dynamodbService = require("./services/dynamodb");
const sqliteService = require("./services/sqlite");

const FOLLOWING_INTERACTION_DELTA_IN_DAYS = 3;
const FOLLOWER_INTERACTION_DELTA_IN_DAYS = 14;
const DATABASE_OBJECT = dynamodbService;

exports.settings = {
  DATABASE_OBJECT,
  FOLLOWING_INTERACTION_DELTA_IN_DAYS,
  FOLLOWER_INTERACTION_DELTA_IN_DAYS,
};
