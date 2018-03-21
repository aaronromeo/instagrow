const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const fs = require('fs');
const dynamodb = require('./dynamodb');

let instance = null;

if (process.env.IS_LOCAL) {
  const COOKIE_LOCATION = "../../cookies";
} else {
  const COOKIE_LOCATION = "/tmp/cookies";
}

const createSession = async (config) => {
  let cookie = await dynamodb.handler.getInstance().getCookiesForUser();
  if (!fs.existsSync(COOKIE_LOCATION)) {
    fs.mkdirSync(COOKIE_LOCATION);
  }
  if (cookie) {
    fs.writeFileSync(`${COOKIE_LOCATION}/${config.username}.json`, JSON.stringify(cookie));
  }

  const device = new Client.Device(config.username);
  const storage = new Client.CookieFileStorage(`${COOKIE_LOCATION}/${config.username}.json`);

  if (instance) return instance;

  const session = await Client.Session.create(device, storage, config.username, config.password);

  cookie = require(`${COOKIE_LOCATION}/${config.username}.json`);
  await dynamodb.handler.getInstance().putCookiesForUser(cookie);
  instance = session;
  return instance;
};

const getSession = () => instance;

exports.session = {
  createSession,
  getSession,
};
