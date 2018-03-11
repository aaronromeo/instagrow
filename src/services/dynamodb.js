const Promise = require('bluebird');
const AWS = require("aws-sdk");
const DynamoDB = Promise.promisifyAll(require("aws-sdk").DynamoDB);

AWS.config.update({
  region: "us-east-1",
  endpoint: "http://localhost:8000"

});
AWS.config.setPromisesDependency(Promise);

class DynamoDBService {
  constructor(config) {
    this.config = config;
    this.tableName = `Instagrow-${config.username}-Accounts`;
    this.db = new AWS.DynamoDB();
  };

  create() {
    const CREATE_SCRIPT = {
      TableName : this.tableName,
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

    return this.db.createTable(CREATE_SCRIPT).promise()
      .then((data) => {
        console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        return new Promise.resolve(data);
      })
      .catch((err) => {
        console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        return new Promise.reject(err);
      });
  }
}

let instance = null;
const createInstance = (config) => {
  instance = new DynamoDBService(config);
  return instance;
}
const getInstance = () => instance;

exports.handler = {
  createInstance,
  getInstance,
};
