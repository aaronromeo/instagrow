const Client = require('instagram-private-api').V1;
const fs = require('fs');
const dynamodb = require('./dynamodb');
const DynamoDBCookieStore = require('./DynamoDBCookieStore');

let instance = null;

const createSession = async ({username, password}) => {
  const device = new Client.Device(username);
  const cookieStore = new DynamoDBCookieStore(username);
  const storage = new Client.CookieStorage(cookieStore);

  if (instance && instance._device && instance._device.username === username) return instance;

  const session = await Client.Session.create(device, storage, username, password);

  instance = session;
  return instance;
};

const getSession = (username) => (instance && instance.username === username) ? instance : null;

exports.session = {
  createSession,
  getSession,
};
