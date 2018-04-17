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
  latestMediaCheckedAt: 0,
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

    try {
      const data = await this.docClient.get(params).promise();
      if (data.Item) {
        return parseInt(data.Item.datavalue);
      }
    } catch(err) {
      console.error(`Unable to get followingInteractionDeltaInDays ${err}`);
      throw err;
    }
    return constants.settings.FOLLOWING_INTERACTION_DELTA_IN_DAYS;
  }

  async followerInteractionDeltaInDays(username) {
    const params = {
      TableName: "Instagrow-Config",
      Key: {
        username: username,
        datatype: 'followerInteractionDeltaInDays',
      },
    };

    try {
      const data = await this.docClient.get(params).promise();
      if (data.Item) {
        return parseInt(data.Item.datavalue);
      }
    } catch(err) {
      console.error(`Unable to get followerInteractionDeltaInDays ${err}`);
      throw err;
    }
    return constants.settings.FOLLOWER_INTERACTION_DELTA_IN_DAYS;
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
      return data;
    } catch(err) {
      console.error("Unable to create table. Error JSON:", err);
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
        ReadCapacityUnits: 2,
        WriteCapacityUnits: 2
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
        ReadCapacityUnits: 2,
        WriteCapacityUnits: 2
      }
    };

    try {
      const data = await this.db.createTable(CREATE_USERS_TABLE_SCRIPT).promise()
      console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
      const createTableData = await this.db.createTable(CREATE_PENDING_MEDIA_TABLE_SCRIPT).promise()
      console.log("Created table. Table description JSON:", JSON.stringify(createTableData, null, 2));
      return createTableData;
    } catch(err) {
      console.error("Unable to create table. Error JSON:", err);
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
      MaxCapacity: 15,
      MinCapacity: 2,
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
        ScaleOutCooldown: 1,
        ScaleInCooldown: 30,
        TargetValue: 60.0,
        PredefinedMetricSpecification: {
          PredefinedMetricType: "DynamoDBWriteCapacityUtilization"
        }
      }
    };
    const paramsReads = {
      MaxCapacity: 15,
      MinCapacity: 2,
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
        ScaleOutCooldown: 1,
        ScaleInCooldown: 30,
        TargetValue: 60.0,
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
      console.error("Unable to delete table. Error JSON:", err);
      throw err;
    };
  }

  async importData(username) {
    const backupName = `${this.getUserTableName(username)}-Bkup-${moment().valueOf()}`
    const backupParams = {
      BackupName: backupName,
      TableName: this.getUserTableName(username),
    };

    const dataMarshal = new dataMarshalService.service.DataMarshal();
    dataMarshal.importData(`data/dump-${username}-dynamodb.json`);

    await Promise.mapSeries(dataMarshal.records, async (record) => {
      const putParams = {
        TableName: this.getUserTableName(username),
        Item: record,
      };

      try {
        await this.docClient.put(putParams).promise();
        console.log(`Imported ${record.username} (${record.instagramId})`);
      } catch(err) {
        console.error(`Unable to add user ${record.username} (${record.instagramId}). Error JSON: ${err}`);
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
      console.error("Unable to describe table. Error JSON:", err);
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
      if (!usernames.length) {
        throw new Error("No usernames are enabled");
      }
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
      console.error(`Unable to get the function ${err}`);
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

  async getFollowing(username) {
    const params = {
      TableName: this.getUserTableName(username),
      FilterExpression:
        "isFollowing=:true AND isActive=:true",
      ExpressionAttributeValues: {
        ":true": true,
      }
    };

    try {
      const data = await this.docClient.scan(params).promise();
      return data.Items;
    } catch(err) {
      console.error(`Unable to fetch cached following accounts from user ${username}`);
      throw err;
    }
  };

  async getFollowers(username) {
    const params = {
      TableName: this.getUserTableName(username),
      FilterExpression:
        "isFollower=:true AND isActive=:true",
      ExpressionAttributeValues: {
        ":true": true,
      }
    };

    try {
      const data = await this.docClient.scan(params).promise();
      return data.Items;
    } catch(err) {
      console.error(`Unable to fetch cached follower accounts from user ${username}`);
      throw err;
    }
  };

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

  async getAccountsPossiblyRequiringInteraction(username, limit=null) {
    const followerInteractionDeltaInDays = await this.followerInteractionDeltaInDays(username);
    const followingInteractionDeltaInDays = await this.followingInteractionDeltaInDays(username);
    const followerInteractionAgeThreshold = followerInteractionDeltaInDays && moment().subtract(followerInteractionDeltaInDays, 'd');
    const minMediaCheckinAt = moment().subtract(1, 'd').valueOf()
    const followingClause = "lastInteractionAt < :lifollowing AND isActive=:true AND isFollowing=:true AND (latestMediaCreatedAt = :zero OR latestMediaCheckedAt < :latestMediaCheckedAt OR latestMediaCheckedAt = :zero)";
    const followerClause = followerInteractionAgeThreshold ? "lastInteractionAt < :lifollower AND isActive=:true AND isFollower=:true AND (latestMediaCreatedAt = :zero OR latestMediaCheckedAt < :latestMediaCheckedAt OR latestMediaCheckedAt = :zero)" : "";
    const filterExpression = followerClause ? `(${followingClause}) OR (${followerClause})` : followingClause;
    const expressionAttributeValues = {
      ":lifollowing": moment().subtract(followingInteractionDeltaInDays, 'd').valueOf(),
      ":true": true,
      ":zero": 0,
      ":latestMediaCheckedAt": minMediaCheckinAt,
    }
    if (followerInteractionAgeThreshold) {
      expressionAttributeValues[":lifollower"] = followerInteractionAgeThreshold.valueOf();
    }
    const params = {
      TableName: this.getUserTableName(username),
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    };

    if (limit) {
      params["Limit"] = limit;
    }

    try {
      const data = await this.docClient.scan(params).promise();
      return data.Items;
    } catch(err) {
      console.error(`Unable to getAccountsPossiblyRequiringInteraction ${err}`);
      throw err;
    }
  };

  async getAccountsToBeLiked(username, limit=null) {
    const followingInteractionDeltaInDays = await this.followingInteractionDeltaInDays(username);
    const followerInteractionDeltaInDays = await this.followerInteractionDeltaInDays(username);
    const maximumAgeOfContentConsidered = moment().subtract(1, 'w');
    const followingInteractionAgeThreshold = moment().subtract(followingInteractionDeltaInDays, 'd');
    const followerInteractionAgeThreshold = followerInteractionDeltaInDays && moment().subtract(followerInteractionDeltaInDays, 'd');
    const followingClause = "latestMediaCreatedAt > :lmca AND lastInteractionAt < latestMediaCreatedAt AND lastInteractionAt < :lifollowing AND isActive=:true AND isFollowing=:true AND latestMediaCheckedAt > :latestMediaCheckedAt";
    const followerClause = followerInteractionAgeThreshold ? "latestMediaCreatedAt > :lmca AND lastInteractionAt < latestMediaCreatedAt AND lastInteractionAt < :lifollower AND isActive=:true AND isFollower=:true AND latestMediaCheckedAt > :latestMediaCheckedAt" : "";
    const filterExpression = followerClause ? `(${followingClause}) OR (${followerClause})` : followingClause;
    const expressionAttributeValues = {
      ":lmca": maximumAgeOfContentConsidered.valueOf(),
      ":lifollowing": followingInteractionAgeThreshold.valueOf(),
      ":latestMediaCheckedAt": moment().subtract(1, 'd').valueOf(),
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

    if (limit) {
      params["Limit"] = limit;
    }

    try {
      const data = await this.docClient.scan(params).promise();
      return data.Items;
    } catch(err) {
      console.error(`Unable to getAccountsToBeLiked ${err}`);
      throw err;
    }
   };

  async addFollowersAccountOrUpdateUsername(username, instagramId, followerUsername, isActive=true) {
    const account = await this.getAccountByInstagramId(username, instagramId);
    const tableName = this.getUserTableName(username);
    try {
      if (account) {
        const params = {
          TableName: tableName,
          Key: {instagramId: instagramId.toString()},
          UpdateExpression: "set username = :u, isFollower = :true, isActive = :isActive",
          ExpressionAttributeValues:{
            ":u": followerUsername,
            ":true": true,
            ":isActive": isActive,
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


  async addFollowingAccountOrUpdateUsername(username, instagramId, followingUsername, isActive=true) {
    const account = await this.getAccountByInstagramId(username, instagramId);
    const tableName = this.getUserTableName(username);
    try {
      if (account) {
        const params = {
          TableName: tableName,
          Key: {instagramId: instagramId.toString()},
          UpdateExpression: "set username = :u, isFollowing = :true, isActive = :isActive",
          ExpressionAttributeValues:{
            ":u": followingUsername,
            ":true": true,
            ":isActive": isActive,
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

  async addLatestMediaToPendingTable(username, instagramId, mediaId, mediaUrl, followUsername) {
    const params = {
      TableName: this.getPendingMediaTableName(username),
      Item: {
        instagramId: instagramId.toString(),
        mediaId,
        mediaUrl,
        username: followUsername,
      },
    };
    try {
      await this.docClient.put(params).promise();
    } catch(err) {
      throw err;
    }
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
      UpdateExpression: "set latestMediaId = :lmi, latestMediaUrl = :lmu, latestMediaCreatedAt = :lmca, latestMediaCheckedAt = :lmcia",
      ExpressionAttributeValues:{
        ":lmi": latestMediaId,
        ":lmu": latestMediaUrl,
        ":lmca": latestMediaCreatedAt,
        ":lmcia": moment().valueOf(),
      },
      ReturnValues:"UPDATED_NEW"
    };
    try {
      await this.docClient.update(params).promise();
    } catch(err) {
      console.error(`Error thrown in updateLatestMediaDetails ${err}`);
    }
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
    try {
      await this.docClient.update(params).promise();
    } catch(err) {
      console.error(`Error thrown in updateLastInteration ${err}`);
    }
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
