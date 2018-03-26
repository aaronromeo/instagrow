const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const fs = require('fs');
const dynamodb = require('./dynamodb');
const DynamoDBCookieStore = require('./DynamoDBCookieStore');

let instance = null;

const createSession = async ({username, password}) => {
  const device = new Client.Device(username);
  const cookieStore = new DynamoDBCookieStore(username);
  const storage = new Client.CookieStorage(cookieStore);

  if (instance) return instance;

  const session = await Client.Session.create(device, storage, username, password);

  instance = session;
  return instance;
};

const getSession = () => instance;

exports.session = {
  createSession,
  getSession,
};
