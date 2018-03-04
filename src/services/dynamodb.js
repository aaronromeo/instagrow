const Promise = require('bluebird');
const AWS = require("aws-sdk");
const DynamoDB = Promise.promisifyAll(require("aws-sdk").DynamoDB);

AWS.config.update({
  region: "us-east-1",
  endpoint: "http://localhost:8000"

});
AWS.config.setPromisesDependency(Promise);

var dynamodb = new AWS.DynamoDB();

var params = {
  TableName : "Instagrow-Accounts",
  KeySchema: [
    { AttributeName: "instagramId", KeyType: "HASH"}   //Partition key
  ],
  AttributeDefinitions: [
    { AttributeName: "instagramId", AttributeType: "S" }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1
  }
};

const create = () => dynamodb.createTable(params).promise()
  .then((data) => {
    console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
    return new Promise.resolve(data);
  })
  .catch((err) => {
    console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
    return new Promise.reject(err);
  });

exports.handler = {
  create,
};
