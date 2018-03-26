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
  constructor() {
    this.db = new AWS.DynamoDB({maxRetries: 13, retryDelayOptions: {base: 200}});
    this.docClient = new AWS.DynamoDB.DocumentClient({maxRetries: 13, retryDelayOptions: {base: 200}});
  };

  async followingInteractionDeltaInDays(username) {
    const params = {
      TableName: "Instagrow-Config",
      Key: {
        username: username,
        datatype: 'followingInteractionDeltaInDays',
      },
    };

    const data = await this.docClient.get(params);
    return (data.Item && data.Item.datavalue) || constants.settings.FOLLOWING_INTERACTION_DELTA_IN_DAYS;
  }

  async followerInteractionDeltaInDays(username) {
    const params = {
      TableName: "Instagrow-Config",
      Key: {
        username: username,
        datatype: 'followerInteractionDeltaInDays',
      },
    };

    const data = await this.docClient.get(params);
    return (data.Item && data.Item.datavalue) || constants.settings.FOLLOWER_INTERACTION_DELTA_IN_DAYS;
  }

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

  getUserTableName(username) {
    return `Instagrow-${username}-Users`;
  }

  getPendingMediaTableName(username) {
    return `Instagrow-${username}-Media-Pending-Likes`;
  }

  createAccountDB(username) {
    const CREATE_USERS_TABLE_SCRIPT = {
      TableName : this.getUserTableName(username),
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
      TableName : this.getPendingMediaTableName(username),
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

  deleteDB(username) {
    return this.db.deleteTable({TableName : this.getUserTableName(username)}).promise()
      .then((data) => {
        console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
        return this.db.deleteTable({TableName : this.getPendingMediaTableName(username)}).promise();
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

  createBackup(username) {
    const backupName = `${this.getUserTableName(username)}-Bkup-${moment().valueOf()}`
    const backupParams = {
      BackupName: backupName,
      TableName: this.getUserTableName(username),
    };

    return this.db.createBackup(backupParams).promise()
      .then(() => {
        console.log(backupName);
        return Promise.resolve(backupName);
      })
  }

  importData(username) {
    const backupName = `${this.getUserTableName(username)}-Bkup-${moment().valueOf()}`
    const backupParams = {
      BackupName: backupName,
      TableName: this.getUserTableName(username),
    };

    const dataMarshal = new dataMarshalService.service.DataMarshal();
    dataMarshal.importData(`data/dump-${username}-dynamodb.json`);

    return Promise.map(dataMarshal.records, async (record) => {
      const putParams = {
        TableName: this.getUserTableName(username),
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
    return this.db.describeTable({ "TableName": this.getUserTableName(username) }).promise()
      .then((tableDescription) => {
        console.log("Describe table successful. Table description JSON:", JSON.stringify(tableDescription, null, 2));
        return this.docClient.scan(tableDescription.Table).promise()
          .then((data) => {
            const dataMarshal = new dataMarshalService.service.DataMarshal();
            data.Items.forEach((record) => {
              dataMarshal.addRecord(record)
            })
            dataMarshal.exportData(`data/dump-${username}-dynamodb.json`);
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

  getCookiesForUser(username) {
    const params = {
      TableName: "Instagrow-Config",
      Key: {
        username: username,
        datatype: 'cookies',
      },
    };

    return this.docClient.get(params).promise()
      .then((data) => {
        return new Promise.resolve(data.Item && data.Item.datavalue);
      })
      .catch((err) => {
        return new Promise.reject(err);
      });
  }

  putCookiesForUser(username, cookie) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username: username,
        datatype: 'cookies',
        datavalue: cookie,
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

  async getPasswordForUser(username) {
    const params = {
      TableName: "Instagrow-Config",
      Key: {
        username: username,
        datatype: 'authentication',
      },
    };

    const data = await this.docClient.get(params).promise();
    return data.Item && data.Item.datavalue;
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

  async putTimestampForFunction(username, funcName) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username: username,
        datatype: `${funcName}Timestamp`,
        datavalue: moment().valueOf(),
      },
    };

    const data = await this.docClient.put(params).promise()
    return new Promise.resolve(data);
  }

  getMediaWithLastInteraction(username) {
    const params = {
      TableName: this.getUserTableName(username),
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

  async getAccountByInstagramId(username, instagramId) {
    const params = {
      TableName: this.getUserTableName(username),
      Key:{
        instagramId: instagramId.toString(),
      }
    };

    const data = await this.docClient.get(params).promise();
    return new Promise.resolve(data.Item);
  };

  getAccountsPossiblyRequiringInteraction(username) {
    const followerInteractionAgeThreshold = this.followerInteractionDeltaInDays() && moment().subtract(this.followerInteractionDeltaInDays(), 'd');
    const followingClause = "lastInteractionAt < :lifollowing AND isActive=:true AND isFollowing=:true";
    const followerClause = followerInteractionAgeThreshold ? "lastInteractionAt < :lifollower AND isActive=:true AND isFollower=:true" : "";
    const filterExpression = followerClause ? `(${followingClause}) OR (${followerClause})` : followingClause;
    const expressionAttributeValues = {
      ":lifollowing": moment().subtract(this.followingInteractionDeltaInDays(), 'd').valueOf(),
      ":true": true,
    }
    if (followerInteractionAgeThreshold) {
      expressionAttributeValues[":lifollower"] = followerInteractionAgeThreshold.valueOf();
    }
    const params = {
      TableName: this.getUserTableName(username),
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

  getAccountsToBeLiked(username) {
    const maximumAgeOfContentConsidered = moment().subtract(1, 'w');
    const followingInteractionAgeThreshold = moment().subtract(this.followingInteractionDeltaInDays(), 'd');
    const followerInteractionAgeThreshold = this.followerInteractionDeltaInDays() && moment().subtract(this.followerInteractionDeltaInDays(), 'd');
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
      TableName: this.getUserTableName(username),
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

  async updateFollowerAccountsToInactive(username) {
    const tableName = this.getUserTableName(username);
    const scanParams = {
      TableName: tableName,
      FilterExpression: "isFollower=:true",
      ExpressionAttributeValues: {
        ":true": true,
      }
    };

    const updateParams = (username, instagramId) => ({
      TableName: tableName,
      Key: {instagramId: instagramId},
      UpdateExpression: "set isActive = :false, isFollower = :false",
      ExpressionAttributeValues:{
        ":false": false,
      },
      ReturnValues:"UPDATED_NEW",
    });

    const data = await this.docClient.scan(scanParams).promise();
    if (!data.Items) return;
    await data.Items.forEach(async (account) => {
      await this.docClient.update(updateParams(account.instagramId.toString()))
    });
  }

  async updateFollowingAccountsToInactive(username) {
    const tableName = this.getUserTableName(username);
    const scanParams = {
      TableName: tableName,
      FilterExpression: "isFollowing=:true",
      ExpressionAttributeValues: {
        ":true": true,
      }
    };

    const updateParams = (username, instagramId) => ({
      TableName: tableName,
      Key: {instagramId: instagramId},
      UpdateExpression: "set isActive = :false, isFollowing = :false",
      ExpressionAttributeValues:{
        ":false": false,
      },
      ReturnValues:"UPDATED_NEW",
    });

    const data = await this.docClient.scan(scanParams).promise();
    if (!data.Items) return;
    await data.Items.forEach(async (account) => {
      await this.docClient.update(updateParams(account.instagramId.toString()))
    });
  }

  async addFollowersAccountOrUpdateUsername(username, instagramId, followerUsername) {
    const account = await this.getAccountByInstagramId(username, instagramId);
    if (account) {
      const params = {
        TableName: this.getUserTableName(username),
        Key: {instagramId: instagramId.toString()},
        UpdateExpression: "set username = :u, isFollower = :true, isActive = :true",
        ExpressionAttributeValues:{
          ":u": followerUsername,
          ":true": true,
        },
        ReturnValues:"UPDATED_NEW"
      };
      await this.docClient.update(params).promise();
      return new Promise.resolve({instagramId: instagramId, username: followerUsername});
    } else {
      const params = {
        TableName: this.getUserTableName(username),
        Item: USER_INITIAL_RECORD(instagramId, followerUsername, false, true)
      };
      await this.docClient.put(params).promise();
      return new Promise.resolve({instagramId: instagramId, username: followerUsername});
    }
  }

  async addFollowingAccountOrUpdateUsername(username, instagramId, followingUsername) {
    const account = await this.getAccountByInstagramId(username, instagramId);
    if (account) {
      const params = {
        TableName: this.getUserTableName(username),
        Key: {instagramId: instagramId.toString()},
        UpdateExpression: "set username = :u, isFollowing = :true, isActive = :true",
        ExpressionAttributeValues:{
          ":u": followingUsername,
          ":true": true,
        },
        ReturnValues:"UPDATED_NEW"
      };
      await this.docClient.update(params).promise();
      return new Promise.resolve({instagramId: instagramId, username: followingUsername});
    } else {
      const params = {
        TableName: this.getUserTableName(username),
        Item: USER_INITIAL_RECORD(instagramId, followingUsername, true, false)
      };
      await this.docClient.put(params).promise();
      return new Promise.resolve({instagramId: instagramId, username: followingUsername});
    }
  }

  addLatestMediaToPendingTable(username, instagramId, mediaId, mediaUrl, followingUsername) {
    const params = {
      TableName: this.getPendingMediaTableName(username),
      Item: {
        instagramId: instagramId.toString(),
        mediaId,
        mediaUrl,
        followingUsername,
      },
    };
    return this.docClient.put(params).promise()
      .then(() => {
        return new Promise.resolve({instagramId, mediaId})
      });
  }

  getLatestMediaFromPendingTable(username, limit=null) {
    const params = {
      TableName: this.getPendingMediaTableName(username),
    };
    if (limit) {
      params['Limit'] = limit;
    }
    return this.docClient.scan(params).promise()
      .then((data) => {
        return new Promise.resolve(data.Items)
      });
  }

  deleteMediaFromPendingTable(username, instagramId, mediaId) {
    const params = {
      TableName: this.getPendingMediaTableName(username),
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

  updateLatestMediaDetails(username, instagramId, latestMediaId, latestMediaUrl, latestMediaCreatedAt) {
    const params = {
      TableName: this.getUserTableName(username),
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

  updateLastInteration(username, instagramId, latestInteraction) {
    const params = {
      TableName: this.getUserTableName(username),
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
const createInstance = () => {
  instance = new DynamoDBService();
  return instance;
}
const getInstance = () => instance;

exports.handler = {
  createInstance,
  getInstance,
};
