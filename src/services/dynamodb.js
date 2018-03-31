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
    this.applicationautoscaling = new AWS.ApplicationAutoScaling({
      apiVersion: '2016-02-06'
    });

  };

  async followingInteractionDeltaInDays(username) {
    const params = {
      TableName: "Instagrow-Config",
      Key: {
        username: username,
        datatype: 'followingInteractionDeltaInDays',
      },
    };

    const data = await this.docClient.get(params).promise();
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

    const data = await this.docClient.get(params).promise();
    return (data.Item && data.Item.datavalue) || constants.settings.FOLLOWER_INTERACTION_DELTA_IN_DAYS;
  }

  getUserTableName(username) {
    return `Instagrow-${username}-Users`;
  }

  getPendingMediaTableName(username) {
    return `Instagrow-${username}-Media-Pending-Likes`;
  }

  async createGeneralDB() {
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

    try {
      const data = await createTable(CREATE_TABLE_SCRIPT).promise();
      console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
      return new Promise.resolve(data);
    } catch(err) {
      console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
      throw err;
    }
  }

  async createAccountDB(username) {
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

    try {
      const data = await this.db.createTable(CREATE_USERS_TABLE_SCRIPT).promise()
      console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
      const createTableData = await this.db.createTable(CREATE_PENDING_MEDIA_TABLE_SCRIPT).promise()
      console.log("Created table. Table description JSON:", JSON.stringify(createTableData, null, 2));
      return new Promise.resolve(createTableData);
    } catch(err) {
      console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
      throw err;
    };
  }

  async createAccountScalingPolicy(username) {
    await this.createTableScalingPolicy(this.getUserTableName(username));
    await this.createTableScalingPolicy(this.getPendingMediaTableName(username));
  }

  async createTableScalingPolicy(tableName) {
    const data = [];
    const paramsWrites = {
      MaxCapacity: 10,
      MinCapacity: 1,
      ResourceId: `table/${tableName}`,
      ScalableDimension: "dynamodb:table:WriteCapacityUnits",
      ServiceNamespace: "dynamodb"
    };
    const scalingWritesPolicy = {
      ServiceNamespace: "dynamodb",
      ResourceId: `table/${tableName}`,
      ScalableDimension: "dynamodb:table:WriteCapacityUnits",
      PolicyName: `${tableName}-write-scaling-policy`,
      PolicyType: "TargetTrackingScaling",
      TargetTrackingScalingPolicyConfiguration: {
        ScaleOutCooldown: 30,
        ScaleInCooldown: 30,
        TargetValue: 80.0,
        PredefinedMetricSpecification: {
          PredefinedMetricType: "DynamoDBWriteCapacityUtilization"
        }
      }
    };
    const paramsReads = {
      MaxCapacity: 10,
      MinCapacity: 1,
      ResourceId: `table/${tableName}`,
      ScalableDimension: "dynamodb:table:ReadCapacityUnits",
      ServiceNamespace: "dynamodb"
    };
    const scalingReadsPolicy = {
      ServiceNamespace: "dynamodb",
      ResourceId: `table/${tableName}`,
      ScalableDimension: "dynamodb:table:ReadCapacityUnits",
      PolicyName: `${tableName}-read-scaling-policy`,
      PolicyType: "TargetTrackingScaling",
      TargetTrackingScalingPolicyConfiguration: {
        ScaleOutCooldown: 30,
        ScaleInCooldown: 30,
        TargetValue: 80.0,
        PredefinedMetricSpecification: {
          PredefinedMetricType: "DynamoDBReadCapacityUtilization"
        }
      }
    };
    data.push(await this.applicationautoscaling.registerScalableTarget(paramsWrites).promise());
    data.push(await this.applicationautoscaling.putScalingPolicy(scalingWritesPolicy).promise());
    data.push(await this.applicationautoscaling.registerScalableTarget(paramsReads).promise());
    data.push(await this.applicationautoscaling.putScalingPolicy(scalingReadsPolicy).promise());

    console.log(JSON.stringify(data));

    return data;
  }

  async putUserEnabled(username, isEnabled) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username,
        datatype: 'enabled',
        datavalue: isEnabled,
      },
    };

    try {
      const data = await this.docClient.put(params).promise()
      console.log(data);
      return data;
    } catch(err) {
      console.error(err);
      throw err;
    };
  }

  async putUserAuthentication(username, password) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username,
        datatype: 'authentication',
        datavalue: password,
      },
    };

    try {
      const data = await this.docClient.put(params).promise()
      console.log(data);
      return data;
    } catch(err) {
      console.error(err);
      throw err;
    };
  }

  async putUserFollowingInteractionDeltaInDays(username, followingInteractionDeltaInDays) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username,
        datatype: 'followingInteractionDeltaInDays',
        datavalue: followingInteractionDeltaInDays,
      },
    };

    try {
      const data = await this.docClient.put(params).promise()
      console.log(data);
      return data;
    } catch(err) {
      console.error(err);
      throw err;
    };
  }

  async putUserFollowerInteractionDeltaInDays(username, followerInteractionDeltaInDays) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username,
        datatype: 'followerInteractionDeltaInDays',
        datavalue: followerInteractionDeltaInDays,
      },
    };

    try {
      const data = await this.docClient.put(params).promise()
      console.log(data);
      return data;
    } catch(err) {
      console.error(err);
      throw err;
    };
  }

  async deleteDB(username) {
    try {
      const data = [];
      data.push(await this.db.deleteTable({TableName : this.getUserTableName(username)}).promise());
      data.push(await this.db.deleteTable({TableName : this.getPendingMediaTableName(username)}).promise());
      console.log("Deleted table. Table description JSON:", JSON.stringify(data, null, 2));
      return data;
    } catch(err) {
      console.error("Unable to delete table. Error JSON:", JSON.stringify(err, null, 2));
      throw err;
    };
  }

  // createBackup(username) {
    // const backupName = `${this.getUserTableName(username)}-Bkup-${moment().valueOf()}`
    // const backupParams = {
      // BackupName: backupName,
      // TableName: this.getUserTableName(username),
    // };
//
    // return this.db.createBackup(backupParams).promise()
      // .then(() => {
        // console.log(backupName);
        // return Promise.resolve(backupName);
      // })
  // }

  async importData(username) {
    const backupName = `${this.getUserTableName(username)}-Bkup-${moment().valueOf()}`
    const backupParams = {
      BackupName: backupName,
      TableName: this.getUserTableName(username),
    };

    const dataMarshal = new dataMarshalService.service.DataMarshal();
    dataMarshal.importData(`data/dump-${username}-dynamodb.json`);

    await Promise.map(dataMarshal.records, async (record) => {
      const putParams = {
        TableName: this.getUserTableName(username),
        Item: record,
      };

      try {
        await this.docClient.put(putParams).promise();
        console.log(`Imported ${record.username} (${record.instagramId})`);
      } catch(err) {
        console.error(`Unable to add user ${record.username} (${record.instagramId}). Error JSON: ${JSON.stringify(err, null, 2)}`);
      }
    })
  }

  async exportData() {
    try {
      const tableDescription = await this.db.describeTable({ "TableName": this.getUserTableName(username) }).promise();
      console.log("Describe table successful. Table description JSON:", JSON.stringify(tableDescription, null, 2));
      const data = await this.docClient.scan(tableDescription.Table).promise();
      const dataMarshal = new dataMarshalService.service.DataMarshal();
      data.Items.forEach((record) => {
        dataMarshal.addRecord(record)
      })
      dataMarshal.exportData(`data/dump-${username}-dynamodb.json`);
      return data;
    } catch(err) {
      console.error("Unable to describe table. Error JSON:", JSON.stringify(err, null, 2));
      throw err;
    }
  }

  async getCookiesForUser(username) {
    const params = {
      TableName: "Instagrow-Config",
      Key: {
        username: username,
        datatype: 'cookies',
      },
    };

    try {
      const data = await this.docClient.get(params).promise();
      return data.Item && data.Item.datavalue;
    } catch(err) {
      console.error(err);
      throw err;
    };
  }

  async putCookiesForUser(username, cookie) {
    const params = {
      TableName: "Instagrow-Config",
      Item: {
        username: username,
        datatype: 'cookies',
        datavalue: cookie,
      },
    };

    try{
      const data = await this.docClient.put(params).promise();
      return data;
    } catch(err) {
      console.error(err);
      throw err;
    }
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

  async getUsers() {
    const params = {
      TableName: "Instagrow-Config",
      FilterExpression:
        "datatype=:enabled AND datavalue=:true",
      ExpressionAttributeValues: {
        ":true": true,
        ":enabled": "enabled",
      }
    };

    try {
      const data = await this.docClient.scan(params).promise();
      const usernames = data.Items.map((item) => item.username)
      return usernames;
    } catch(err) {
      console.error(err);
      throw err;
    }
  }

  async getNextUserForFunction(funcName) {
    try {
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

      const data = await this.docClient.scan(params).promise()
      const usernameMap = usernames.reduce((accumulator, username) => {
        const psuedoItem = data.Items.find(item => item.username === username) || {datavalue: 0};
        const value = psuedoItem.datavalue;
        if (accumulator.max > value) {
          accumulator.username = username;
          accumulator.max = value;
        }
        return accumulator;
      }, {username: null, max: moment().valueOf()});
      return usernameMap.username;
    } catch(err) {
      console.error(`Unable to get the function #{err}`);
      throw err;
    }
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
    return data;
  }

  async getMediaWithLastInteraction(username) {
    const params = {
      TableName: this.getUserTableName(username),
      FilterExpression:
        "lastInteractionAt > :li",
      ExpressionAttributeValues: {
        ":li": 0,
      }
    };

    try{
      const data = await this.docClient.scan(params).promise();
      const reducer = (accumulator, item) =>
        item.lastInteractionAt > accumulator.lastInteractionAt ? item : accumulator;

      return data.Items && data.Items.reduce(reducer, {lastInteractionAt: 0});
    } catch(err) {
      throw err;
    };
  };

  async getAccountByInstagramId(username, instagramId) {
    const params = {
      TableName: this.getUserTableName(username),
      Key:{
        instagramId: instagramId.toString(),
      }
    };

    try {
      const data = await this.docClient.get(params).promise();
      return data.Item;
    } catch(err) {
      console.error(`Unable to fetch account from Instagram ID ${instagramId}`);
      throw err;
    }
  };

  async getAccountsPossiblyRequiringInteraction(username) {
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

    try {
      const data = await this.docClient.scan(params).promise();
      return data.Items;
    } catch(err) {
      console.error(`Unable to getAccountsPossiblyRequiringInteraction ${JSON.stringify(err)}`);
      throw err;
    }
  };

  async getAccountsToBeLiked(username) {
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

    try {
      const data = await this.docClient.scan(params).promise();
      return data.Items;
    } catch(err) {
      console.error(`Unable to getAccountsToBeLiked ${JSON.stringify(err)}`);
      throw err;
    }
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

    try {
      const data = await this.docClient.scan(scanParams).promise();
      if (!data.Items) return;
      const output = await Promise.map(data.Items, async (account) => {
        const nextParams = updateParams(username, account.instagramId.toString());
        try {
          return await this.docClient.update(nextParams).promise();
        } catch(err) {
          console.error(`Error updating ${JSON.stringify(nextParams)}`);
          throw err;
        }
      });
      return output;
    } catch(err) {
      console.error(`Unable to updateFollowerAccountsToInactive for ${username}`);
      throw err;
    }
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

    try {
      const data = await this.docClient.scan(scanParams).promise();
      if (!data.Items) return;
      const output = await Promise.map(data.Items, async (account) => {
        const nextParams = updateParams(username, account.instagramId.toString());
        try {
          return await this.docClient.update(updateParams(username, account.instagramId.toString())).promise()
        } catch(err) {
          console.error(`Error updating ${JSON.stringify(nextParams)}`);
          throw err;
        }
      });
      return output;
    } catch(err) {
      console.error(`Unable to updateFollowingAccountsToInactive for ${username}`);
      throw err;
    }
  }

  async addFollowersAccountOrUpdateUsernameBatch(username, followersResults) {
    const tableName = this.getUserTableName(username);
    const data = await Promise.map(followersResults, async (user) =>{
      return await this.addFollowersAccountOrUpdateUsername(username, user.id, user._params.username)
    });

    return data;
  }

  async addFollowersAccountOrUpdateUsername(username, instagramId, followerUsername) {
    const account = await this.getAccountByInstagramId(username, instagramId);
    const tableName = this.getUserTableName(username);
    try {
      if (account) {
        const params = {
          TableName: tableName,
          Key: {instagramId: instagramId.toString()},
          UpdateExpression: "set username = :u, isFollower = :true, isActive = :true",
          ExpressionAttributeValues:{
            ":u": followerUsername,
            ":true": true,
          },
          ReturnValues:"UPDATED_NEW"
        };
        await this.docClient.update(params).promise();
        return {instagramId: instagramId, username: followerUsername};
      } else {
        const params = {
          TableName: tableName,
          Item: USER_INITIAL_RECORD(instagramId, followerUsername, false, true)
        };
        await this.docClient.put(params).promise();
        return {instagramId: instagramId, username: followerUsername};
      }
    } catch(err) {
      console.error(`Error updating follower ${instagramId} ${followerUsername}`);
      throw err;
    }
  }


  async addFollowingAccountOrUpdateUsernameBatch(username, followingResults) {
    const tableName = this.getUserTableName(username);
    const data = await Promise.map(followingResults, async (user) =>{
      return await this.addFollowingAccountOrUpdateUsername(username, user.id, user._params.username);
    });
    return data;
  }

  async addFollowingAccountOrUpdateUsername(username, instagramId, followingUsername) {
    const account = await this.getAccountByInstagramId(username, instagramId);
    const tableName = this.getUserTableName(username);
    try {
      if (account) {
        const params = {
          TableName: tableName,
          Key: {instagramId: instagramId.toString()},
          UpdateExpression: "set username = :u, isFollowing = :true, isActive = :true",
          ExpressionAttributeValues:{
            ":u": followingUsername,
            ":true": true,
          },
          ReturnValues:"UPDATED_NEW"
        };
        await this.docClient.update(params).promise();
        return {instagramId: instagramId, username: followingUsername};
      } else {
        const params = {
          TableName: tableName,
          Item: USER_INITIAL_RECORD(instagramId, followingUsername, true, false)
        };
        await this.docClient.put(params).promise();
        return {instagramId: instagramId, username: followingUsername};
      }
    } catch(err) {
      console.error(`Error updating following account ${instagramId} ${followingUsername}`);
      throw err;
    }
  }

  async addLatestMediaToPendingTable(username, instagramId, mediaId, mediaUrl, followingUsername) {
    const params = {
      TableName: this.getPendingMediaTableName(username),
      Item: {
        instagramId: instagramId.toString(),
        mediaId,
        mediaUrl,
        followingUsername,
      },
    };
    await this.docClient.put(params).promise();
    return {instagramId, mediaId};
  }

  async getLatestMediaFromPendingTable(username, limit=null) {
    const params = {
      TableName: this.getPendingMediaTableName(username),
    };
    if (limit) {
      params['Limit'] = limit;
    }
    const data = await this.docClient.scan(params).promise();
    return data.Items;
  }

  async deleteMediaFromPendingTable(username, instagramId, mediaId) {
    const params = {
      TableName: this.getPendingMediaTableName(username),
      Key: {
        instagramId,
        mediaId,
      }
    };
    const data = await this.docClient.delete(params).promise();
    return data.Items;
  }

  async updateLatestMediaDetails(username, instagramId, latestMediaId, latestMediaUrl, latestMediaCreatedAt) {
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
    await this.docClient.update(params).promise();
    return {instagramId: instagramId};
  }

  async updateLastInteration(username, instagramId, latestInteraction) {
    const params = {
      TableName: this.getUserTableName(username),
      Key: {instagramId: instagramId.toString()},
      UpdateExpression: "set lastInteractionAt = :li",
      ExpressionAttributeValues:{
        ":li": latestInteraction,
      },
      ReturnValues:"UPDATED_NEW"
    };
    await this.docClient.update(params).promise();
    return {instagramId: instagramId};
  }
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
