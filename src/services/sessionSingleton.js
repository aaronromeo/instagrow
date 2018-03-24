const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const fs = require('fs');
const dynamodb = require('./dynamodb');
const DynamoDBCookieStore = require('./DynamoDBCookieStore');

let instance = null;

const createSession = async (config) => {
  const device = new Client.Device(config.username);
  const cookieStore = new DynamoDBCookieStore();
  const storage = new Client.CookieStorage(cookieStore);

  if (instance) return instance;

  const session = await Client.Session.create(device, storage, config.username, config.password);

  instance = session;
  return instance;
};

const getSession = () => instance;

exports.session = {
  createSession,
  getSession,
};
