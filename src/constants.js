const dynamodbService = require("./services/dynamodb");
const sqliteService = require("./services/sqlite");

const FOLLOWING_INTERACTION_DELTA_IN_DAYS = 3;
const DATABASE_OBJECT = dynamodbService;

exports.settings = {
  DATABASE_OBJECT,
  FOLLOWING_INTERACTION_DELTA_IN_DAYS,
};
