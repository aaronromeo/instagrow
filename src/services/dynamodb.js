const Promise = require('bluebird');
const AWS = require("aws-sdk");
const DynamoDB = Promise.promisifyAll(require("aws-sdk").DynamoDB);
const fs = require('fs');
const humps = require('humps');
const moment = require('moment');
const constants = require("../constants");

const USER_INITIAL_RECORD = (instagramOwner, instagramId, username) => ({
  instagramOwner,
  instagramId: instagramId.toString(),
  username,
  lastInteractionAt: 0,
  latestMediaCreatedAt: 0,
  latestMediaId: null,
  latestMediaUrl: null,
});

AWS.config.update({
  region: "us-east-1",
  endpoint: "http://localhost:8000"

});
AWS.config.setPromisesDependency(Promise);

class DynamoDBService {
  constructor(config) {
    this.config = config;
    this.usersTable = `Instagrow-Users`;
    this.db = new AWS.DynamoDB();
    this.docClient = new AWS.DynamoDB.DocumentClient();
    this.followingInteractionDeltaInDays = config.followingInteractionDeltaInDays || constants.settings.FOLLOWING_INTERACTION_DELTA_IN_DAYS

    this.addAccountOrUpdateUsername.bind(this);
  };

  createDB() {
    const CREATE_SCRIPT = {
      TableName : this.usersTable,
      KeySchema: [
        { AttributeName: "instagramOwner", KeyType: "HASH"},
        { AttributeName: "instagramId", KeyType: "RANGE"}
      ],
      AttributeDefinitions: [
        { AttributeName: "instagramOwner", AttributeType: "S" },
        { AttributeName: "instagramId", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      }
    };

    const UPDATE_SCRIPT = {
      TableName : this.usersTable,
      AttributeDefinitions: [
        { AttributeName: "instagramOwner", AttributeType: "S"},
        { AttributeName: "lastInteractionAt", AttributeType: "N" }
      ],
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: "lastInteractionIndex",
            KeySchema: [
              {AttributeName: "instagramOwner", KeyType: "HASH"},
              {AttributeName: "lastInteractionAt", KeyType: "RANGE"},
            ],
            Projection: {
              "ProjectionType": "ALL"
            },
            ProvisionedThroughput: {
              "ReadCapacityUnits": 1,"WriteCapacityUnits": 1
            }
          }
        }
      ]
    };

    return this.db.createTable(CREATE_SCRIPT).promise()
      .then((data) => {
        this.db.updateTable(UPDATE_SCRIPT).promise()
        return new Promise.resolve(data);
      })
      .then((data) => {
        console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        return new Promise.resolve(data);
      })
      .catch((err) => {
        console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        return new Promise.reject(err);
      });
  }

  deleteDB() {
    return this.db.deleteTable({TableName : this.usersTable}).promise()
      .then((data) => {
        console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
        return new Promise.resolve(data);
      })
      .catch((err) => {
        console.error("Unable to delete table. Error JSON:", JSON.stringify(err, null, 2));
        return new Promise.reject(err);
      });
  }

  importData() {
    const allUsers = JSON.parse(fs.readFileSync(`data/dump-${this.config.username}.json`, 'utf8'));
    allUsers.forEach((underscoreUser) => {
      const user = humps.camelizeKeys(underscoreUser);
      const params = {
        TableName: this.usersTable,
        Item: Object.assign({}, user, {
          instagramId: user.instagramId.toString(),
          lastInteractionAt: (user.lastInteractionAt || 0),
          latestMediaCreatedAt: (user.latestMediaCreatedAt || 0),
          instagramOwner: this.config.username,
        }),
      };

      this.docClient.put(params, (err, data) => {
        if (err) {
          console.error("Unable to add user", user.instagramId, ". Error JSON:", JSON.stringify(err, null, 2));
        } else {
          console.log("PutItem succeeded:", user.instagramId);
        }
      });
    });
  }

  getMediaWithLastInteraction() {
    const params = {
      TableName: this.usersTable,
      IndexName: "lastInteractionIndex",
      KeyConditionExpression:
        "instagramOwner = :io AND lastInteractionAt > :li",
      ExpressionAttributeValues: {
        ":io": this.config.username,
        ":li": 0
      },
      Limit: 1,
      ScanIndexForward: false,
    };

    return this.docClient.query(params).promise()
      .then((data) => {
        return new Promise.resolve(data.Items && data.Items[0]);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  };

  getAccountByInstagramId(instagramId) {
    const params = {
      TableName: this.usersTable,
      Key:{
        instagramId: instagramId.toString(),
        instagramOwner: this.config.username,
      }
    };

    return this.docClient.get(params).promise()
      .then((data) => {
        return new Promise.resolve(data.Item);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  };

  getAccountsPossiblyRequiringInteraction() {
    const params = {
      TableName: this.usersTable,
      IndexName: "lastInteractionIndex",
      KeyConditionExpression:
        "instagramOwner = :io AND lastInteractionAt < :li",
      ExpressionAttributeValues: {
        ":io": this.config.username,
        ":li": moment().subtract(this.followingInteractionDeltaInDays, 'd').valueOf(),
      },
    };

    return this.docClient.query(params).promise()
      .then((data) => {
        return new Promise.resolve(data.Items);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  };

  getAccountsToBeLiked() {
    const maximumAgeOfContentConsidered = moment().subtract(1, 'w');
    const interactionAgeThreshold = moment().subtract(this.followingInteractionDeltaInDays, 'd');
    console.log(maximumAgeOfContentConsidered);
    console.log(interactionAgeThreshold);

    const params = {
      TableName: this.usersTable,
      KeyConditionExpression:
        "instagramOwner = :io",
      FilterExpression:
        "latestMediaCreatedAt > :lmca AND lastInteractionAt < latestMediaCreatedAt AND lastInteractionAt < :li",
      ExpressionAttributeValues: {
        ":io": this.config.username,
        ":lmca": maximumAgeOfContentConsidered.valueOf(),
        ":li": interactionAgeThreshold.valueOf(),
      },
    };

    return this.docClient.query(params).promise()
      .then((data) => {
        const item = data.Items.find(item => item.latestMediaCreatedAt < maximumAgeOfContentConsidered.valueOf() ||
          item.lastInteractionAt > item.latestMediaCreatedAt ||
          item.lastInteractionAt > interactionAgeThreshold.valueOf()
        );
        if (item) { throw JSON.stringify(item) };
        return new Promise.resolve(data.Items);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
   };

  addAccountOrUpdateUsername(instagramId, username) {
    return this.getAccountByInstagramId(instagramId)
      .then((account) => {
        if (account && account) {
          const params = {
            TableName: this.usersTable,
            Key: {instagramOwner: this.config.username, instagramId: instagramId.toString()},
            UpdateExpression: "set username = :u",
            ExpressionAttributeValues:{
              ":u": username
            },
            ReturnValues:"UPDATED_NEW"
          };
          return this.docClient.update(params).promise()
            .then(() => {
              return new Promise.resolve({instagramId: instagramId, username: username})
            });
        } else {
          const params = {
            TableName: this.usersTable,
            Item: USER_INITIAL_RECORD(this.config.username, instagramId, username)
          };
          return this.docClient.put(params).promise()
            .then(() => {
              return new Promise.resolve({instagramId: instagramId, username: username})
            });
        }
      })
  }

  updateLatestMediaDetails(instagramId, latestMediaId, latestMediaUrl, latestMediaCreatedAt) {
    const params = {
      TableName: this.usersTable,
      Key: {instagramOwner: this.config.username, instagramId: instagramId.toString()},
      UpdateExpression: "set latestMediaId = :lmi, latestMediaUrl = :lmu, latestMediaCreatedAt = :lmca",
      ExpressionAttributeValues:{
        ":lmi": latestMediaId,
        ":lmu": latestMediaUrl,
        ":lmca": latestMediaCreatedAt,
      },
      ReturnValues:"UPDATED_NEW"
    };
    return this.docClient.update(params).promise()
      .then(() => new Promise.resolve({instagramId: instagramId}));
  }

  updateLastInteration(instagramId, latestInteraction) {
    const params = {
      TableName: this.usersTable,
      Key: {instagramOwner: this.config.username, instagramId: instagramId.toString()},
      UpdateExpression: "set lastInteractionAt = :li",
      ExpressionAttributeValues:{
        ":li": latestInteraction,
      },
      ReturnValues:"UPDATED_NEW"
    };
    return this.docClient.update(params).promise()
      .then(() => new Promise.resolve({instagramId: instagramId}));
  }

  close() {}
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
