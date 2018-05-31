const dynamodbService = require("./services/dynamodb");

const FOLLOWING_INTERACTION_DELTA_IN_DAYS = 3;
const FOLLOWER_INTERACTION_DELTA_IN_DAYS = 0;
const DATABASE_OBJECT = dynamodbService;
const REGION = "ca-central-1";

exports.settings = {
  DATABASE_OBJECT,
  FOLLOWING_INTERACTION_DELTA_IN_DAYS,
  FOLLOWER_INTERACTION_DELTA_IN_DAYS,
};
