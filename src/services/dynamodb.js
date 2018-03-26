const Promise = require('bluebird');
const AWS = require("aws-sdk");
const DynamoDB = Promise.promisifyAll(require("aws-sdk").DynamoDB);
const fs = require('fs');
const _ = require('lodash');
const humps = require('humps');
const moment = require('moment');
const constants = require("../constants");
const dataMarshalService = require("./dataMarshal");

const USER_INITIAL_RECORD = (instagramId, username, isFollowing, isFollower) => ({
  instagramId: instagramId.toString(),
  username,
  lastInteractionAt: 0,
  latestMediaCreatedAt: 0,
  latestMediaId: null,
  latestMediaUrl: null,
  isFollowing,
  isFollower,
  isActive: true,
});

let configOptions = {
  region: "ca-central-1",
};
if (process.env.IS_OFFLINE) {
  console.log("in offline mode");
  configOptions = {
    region: 'localhost',
    endpoint: 'http://localhost:8000'
  }
}
AWS.config.update(configOptions);
AWS.config.setPromisesDependency(Promise);


class DynamoDBService {
  constructor(config) {
    this.config = config;
    this.db = new AWS.DynamoDB({maxRetries: 13, retryDelayOptions: {base: 200}});
    this.docClient = new AWS.DynamoDB.DocumentClient({maxRetries: 13, retryDelayOptions: {base: 200}});
    this.followingInteractionDeltaInDays = config.followingInteractionDeltaInDays || constants.settings.FOLLOWING_INTERACTION_DELTA_IN_DAYS
    this.followerInteractionDeltaInDays = config.hasOwnProperty("followerInteractionDeltaInDays") ? config.followerInteractionDeltaInDays : constants.settings.FOLLOWER_INTERACTION_DELTA_IN_DAYS
    this.userTableName = `Instagrow-${this.config.username}-Users`;
    this.pendingMediaTableName = `Instagrow-${this.config.username}-Media-Pending-Likes`;
  };

  createGeneralDB() {
    const CREATE_TABLE_SCRIPT = {
      TableName : "Instagrow-Config",
      KeySchema: [
        { AttributeName: "username", KeyType: "HASH"},
        { AttributeName: "datatype", KeyType: "RANGE"}
      ],
      AttributeDefinitions: [
        { AttributeName: "username", AttributeType: "S" },
        { AttributeName: "datatype", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      }
    };

    this.db.createTable(CREATE_TABLE_SCRIPT).promise()
      .then((data) => {
        console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        return new Promise.resolve(data);
      })
      .catch((err) => {
        console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        return new Promise.reject(err);
      });
  }

  createAccountDB() {
    const CREATE_USERS_TABLE_SCRIPT = {
      TableName : this.userTableName,
      KeySchema: [
        { AttributeName: "instagramId", KeyType: "HASH"}
      ],
      AttributeDefinitions: [
        { AttributeName: "instagramId", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      }
    };

    const CREATE_PENDING_MEDIA_TABLE_SCRIPT = {
      TableName : this.pendingMediaTableName,
      KeySchema: [
        { AttributeName: "mediaId", KeyType: "HASH"},
        { AttributeName: "instagramId", KeyType: "RANGE"}
      ],
      AttributeDefinitions: [
        { AttributeName: "mediaId", AttributeType: "S" },
        { AttributeName: "instagramId", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      }
    };

    return this.db.createTable(CREATE_USERS_TABLE_SCRIPT).promise()
      .then((data) => {
        console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        return this.db.createTable(CREATE_PENDING_MEDIA_TABLE_SCRIPT).promise()
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

  putUserEnabled(username, isEnabled) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username,
        datatype: 'enabled',
        datavalue: isEnabled,
      },
    };

    return this.docClient.put(params).promise()
      .then((data) => {
        return new Promise.resolve(data);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  }

  putUserAuthentication(username, password) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username,
        datatype: 'authentication',
        datavalue: password,
      },
    };

    return this.docClient.put(params).promise()
      .then((data) => {
        return new Promise.resolve(data);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  }

  putUserFollowingInteractionDeltaInDays(username, followingInteractionDeltaInDays) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username,
        datatype: 'followingInteractionDeltaInDays',
        datavalue: followingInteractionDeltaInDays,
      },
    };

    return this.docClient.put(params).promise()
      .then((data) => {
        return new Promise.resolve(data);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  }

  putUserFollowerInteractionDeltaInDays(username, followerInteractionDeltaInDays) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username,
        datatype: 'followerInteractionDeltaInDays',
        datavalue: followerInteractionDeltaInDays,
      },
    };

    return this.docClient.put(params).promise()
      .then((data) => {
        return new Promise.resolve(data);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  }

  deleteDB() {
    return this.db.deleteTable({TableName : this.userTableName}).promise()
      .then((data) => {
        console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
        return this.db.deleteTable({TableName : this.pendingMediaTableName}).promise();
      })
      .then((data) => {
        console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
        return new Promise.resolve(data);
      })
      .catch((err) => {
        console.error("Unable to delete table. Error JSON:", JSON.stringify(err, null, 2));
        return new Promise.reject(err);
      });
  }

  createBackup() {
    const backupName = `${this.userTableName}-Bkup-${moment().valueOf()}`
    const backupParams = {
      BackupName: backupName,
      TableName: this.userTableName,
    };

    return this.db.createBackup(backupParams).promise()
      .then(() => {
        console.log(backupName);
        return Promise.resolve(backupName);
      })
  }

  importData() {
    const backupName = `${this.userTableName}-Bkup-${moment().valueOf()}`
    const backupParams = {
      BackupName: backupName,
      TableName: this.userTableName,
    };

    const dataMarshal = new dataMarshalService.service.DataMarshal();
    dataMarshal.importData(`data/dump-${this.config.username}-dynamodb.json`);

    return Promise.map(dataMarshal.records, async (record) => {
      const putParams = {
        TableName: this.userTableName,
        Item: record,
      };

      await this.docClient.put(putParams, (err, data) => {
        if (err) {
          console.error(`Unable to add user ${record.username} (${record.instagramId}). Error JSON: ${JSON.stringify(err, null, 2)}`);
        } else {
          console.log(`Imported ${record.username} (${record.instagramId})`);
        }
      });
    })
  }

  exportData() {
    return this.db.describeTable({ "TableName": this.userTableName }).promise()
      .then((tableDescription) => {
        console.log("Describe table successful. Table description JSON:", JSON.stringify(tableDescription, null, 2));
        return this.docClient.scan(tableDescription.Table).promise()
          .then((data) => {
            const dataMarshal = new dataMarshalService.service.DataMarshal();
            data.Items.forEach((record) => {
              dataMarshal.addRecord(record)
            })
            dataMarshal.exportData(`data/dump-${this.config.username}-dynamodb.json`);
            return new Promise.resolve(data);
          })
          .catch((err) => {
            return new Promise.reject(err);
          });
      })
      .catch((err) => {
        console.error("Unable to describe table. Error JSON:", JSON.stringify(err, null, 2));
        return new Promise.reject(err);
      });
  }

  getCookiesForUser() {
    const params = {
      TableName: "Instagrow-Config",
      Key: {
        username: this.config.username,
        datatype: 'cookies',
      },
    };

    return this.docClient.get(params).promise()
      .then((data) => {
        return new Promise.resolve(data.Item && data.Item.cookie);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  }

  putCookiesForUser(cookie) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username: this.config.username,
        datatype: 'cookies',
        cookie,
      },
    };

    return this.docClient.put(params).promise()
      .then((data) => {
        return new Promise.resolve(data);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  }

  getUsers() {
    const params = {
      TableName: "Instagrow-Config",
      FilterExpression:
        "datatype=:enabled AND datavalue=:true",
      ExpressionAttributeValues: {
        ":true": true,
        ":enabled": "enabled",
      }
    };

    return this.docClient.scan(params).promise()
      .then((data) => {
        const usernames = data.Items.map((item) => item.username)
        return new Promise.resolve(usernames);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  }

  async getNextUserForFunction(funcName) {
    const usernames = await this.getUsers();
    const usernameObject = usernames.reduce((accumulator, username) => {
      accumulator[`:${username}`] = username;
      return accumulator;
    }, {});
    const params = {
      TableName: "Instagrow-Config",
      FilterExpression : `datatype = :functionName AND username IN (${Object.keys(usernameObject).toString()})`,
      ExpressionAttributeValues : Object.assign({}, usernameObject, {":functionName": `${funcName}Timestamp`}),
    };

    return this.docClient.scan(params).promise()
      .then((data) => {
        const usernameMap = usernames.reduce((accumulator, username) => {
          const psuedoItem = data.Items.find(item => item.username === username) || {datavalue: 0};
          const value = psuedoItem.datavalue;
          if (accumulator.max > value) {
            accumulator.username = username;
            accumulator.max = value;
          }
          return accumulator;
        }, {username: null, max: moment().valueOf()});
        return new Promise.resolve(usernameMap.username);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  }

  getMediaWithLastInteraction() {
    const params = {
      TableName: this.userTableName,
      FilterExpression:
        "lastInteractionAt > :li",
      ExpressionAttributeValues: {
        ":li": 0,
      }
    };

    return this.docClient.scan(params).promise()
      .then((data) => {
        const reducer = (accumulator, item) =>
          item.lastInteractionAt > accumulator.lastInteractionAt ? item : accumulator;

        return new Promise.resolve(
          data.Items && data.Items.reduce(reducer, {lastInteractionAt: 0})
        );
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  };

  getAccountByInstagramId(instagramId) {
    const params = {
      TableName: this.userTableName,
      Key:{
        instagramId: instagramId.toString(),
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
    const followerInteractionAgeThreshold = this.followerInteractionDeltaInDays && moment().subtract(this.followerInteractionDeltaInDays, 'd');
    const followingClause = "lastInteractionAt < :lifollowing AND isActive=:true AND isFollowing=:true";
    const followerClause = followerInteractionAgeThreshold ? "lastInteractionAt < :lifollower AND isActive=:true AND isFollower=:true" : "";
    const filterExpression = followerClause ? `(${followingClause}) OR (${followerClause})` : followingClause;
    const expressionAttributeValues = {
      ":lifollowing": moment().subtract(this.followingInteractionDeltaInDays, 'd').valueOf(),
      ":true": true,
    }
    if (followerInteractionAgeThreshold) {
      expressionAttributeValues[":lifollower"] = followerInteractionAgeThreshold.valueOf();
    }
    const params = {
      TableName: this.userTableName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    };

    return this.docClient.scan(params).promise()
      .then((data) => {
        return new Promise.resolve(data.Items);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  };

  getAccountsToBeLiked() {
    const maximumAgeOfContentConsidered = moment().subtract(1, 'w');
    const followingInteractionAgeThreshold = moment().subtract(this.followingInteractionDeltaInDays, 'd');
    const followerInteractionAgeThreshold = this.followerInteractionDeltaInDays && moment().subtract(this.followerInteractionDeltaInDays, 'd');
    const followingClause = "latestMediaCreatedAt > :lmca AND lastInteractionAt < latestMediaCreatedAt AND lastInteractionAt < :lifollowing AND isActive=:true AND isFollowing=:true";
    const followerClause = followerInteractionAgeThreshold ? "latestMediaCreatedAt > :lmca AND lastInteractionAt < latestMediaCreatedAt AND lastInteractionAt < :lifollower AND isActive=:true AND isFollower=:true" : "";
    const filterExpression = followerClause ? `(${followingClause}) OR (${followerClause})` : followingClause;
    const expressionAttributeValues = {
      ":lmca": maximumAgeOfContentConsidered.valueOf(),
      ":lifollowing": followingInteractionAgeThreshold.valueOf(),
      ":true": true,
    }
    if (followerInteractionAgeThreshold) {
      expressionAttributeValues[":lifollower"] = followerInteractionAgeThreshold.valueOf();
    }

    const params = {
      TableName: this.userTableName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    };

    return this.docClient.scan(params).promise()
      .then((data) => {
        return new Promise.resolve(data.Items);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
   };

  updateFollowerAccountsToInactive() {
    const scanParams = {
      TableName: this.userTableName,
      FilterExpression: "isFollower=:true",
      ExpressionAttributeValues: {
        ":true": true,
      }
    };

    const updateParams = (instagramId) => ({
      TableName: this.userTableName,
      Key: {instagramId: instagramId},
      UpdateExpression: "set isActive = :false, isFollower = :false",
      ExpressionAttributeValues:{
        ":false": false,
      },
      ReturnValues:"UPDATED_NEW",
    });

    return this.docClient.scan(scanParams).promise()
      .then((data) => Promise.map(data.Items, (account) => this.docClient.update(
        updateParams(account.instagramId.toString()))
      ));
  }

  updateFollowingAccountsToInactive() {
    const scanParams = {
      TableName: this.userTableName,
      FilterExpression: "isFollowing=:true",
      ExpressionAttributeValues: {
        ":true": true,
      }
    };

    const updateParams = (instagramId) => ({
      TableName: this.userTableName,
      Key: {instagramId: instagramId},
      UpdateExpression: "set isActive = :false, isFollowing = :false",
      ExpressionAttributeValues:{
        ":false": false,
      },
      ReturnValues:"UPDATED_NEW",
    });

    return this.docClient.scan(scanParams).promise()
      .then((data) => Promise.map(data.Items, (account) => this.docClient.update(
        updateParams(account.instagramId.toString()))
      ));
  }

  addFollowersAccountOrUpdateUsername(instagramId, username) {
    return this.getAccountByInstagramId(instagramId)
      .then((account) => {
        if (account) {
          const params = {
            TableName: this.userTableName,
            Key: {instagramId: instagramId.toString()},
            UpdateExpression: "set username = :u, isFollower = :true, isActive = :true",
            ExpressionAttributeValues:{
              ":u": username,
              ":true": true,
            },
            ReturnValues:"UPDATED_NEW"
          };
          return this.docClient.update(params).promise()
            .then(() => {
              return new Promise.resolve({instagramId: instagramId, username: username})
            });
        } else {
          const params = {
            TableName: this.userTableName,
            Item: USER_INITIAL_RECORD(instagramId, username, false, true)
          };
          return this.docClient.put(params).promise()
            .then(() => {
              return new Promise.resolve({instagramId: instagramId, username: username})
            });
        }
      })
  }

  addFollowingAccountOrUpdateUsername(instagramId, username) {
    return this.getAccountByInstagramId(instagramId)
      .then((account) => {
        if (account) {
          const params = {
            TableName: this.userTableName,
            Key: {instagramId: instagramId.toString()},
            UpdateExpression: "set username = :u, isFollowing = :true, isActive = :true",
            ExpressionAttributeValues:{
              ":u": username,
              ":true": true,
            },
            ReturnValues:"UPDATED_NEW"
          };
          return this.docClient.update(params).promise()
            .then(() => {
              return new Promise.resolve({instagramId: instagramId, username: username})
            });
        } else {
          const params = {
            TableName: this.userTableName,
            Item: USER_INITIAL_RECORD(instagramId, username, true, false)
          };
          return this.docClient.put(params).promise()
            .then(() => {
              return new Promise.resolve({instagramId: instagramId, username: username})
            });
        }
      })
  }

  addLatestMediaToPendingTable(instagramId, mediaId, mediaUrl, username) {
    const params = {
      TableName: this.pendingMediaTableName,
      Item: {
        instagramId: instagramId.toString(),
        mediaId,
        mediaUrl,
        username,
      },
    };
    return this.docClient.put(params).promise()
      .then(() => {
        return new Promise.resolve({instagramId, mediaId})
      });
  }

  getLatestMediaFromPendingTable(limit=null) {
    const params = {
      TableName: this.pendingMediaTableName,
    };
    if (limit) {
      params['Limit'] = limit;
    }
    return this.docClient.scan(params).promise()
      .then((data) => {
        return new Promise.resolve(data.Items)
      });
  }

  deleteMediaFromPendingTable(instagramId, mediaId) {
    const params = {
      TableName: this.pendingMediaTableName,
      Key: {
        instagramId,
        mediaId,
      }
    };
    return this.docClient.delete(params).promise()
      .then((data) => {
        return new Promise.resolve(data.Items)
      });
  }

  updateLatestMediaDetails(instagramId, latestMediaId, latestMediaUrl, latestMediaCreatedAt) {
    const params = {
      TableName: this.userTableName,
      Key: {instagramId: instagramId.toString()},
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
      TableName: this.userTableName,
      Key: {instagramId: instagramId.toString()},
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
