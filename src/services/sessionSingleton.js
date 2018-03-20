const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');
const fs = require('fs');

let instance = null;
const createSession = Promise.method((config) => {
  if (!fs.existsSync("/tmp/cookies")) {
    fs.mkdirSync("/tmp/cookies");
  }
  const device = new Client.Device(config.username);
  const storage = new Client.CookieFileStorage(`/tmp/cookies/${config.username}.json`);

  if (instance) return instance;

  return Client.Session.create(device, storage, config.username, config.password)
    .then((session) => {
      instance = session;
      return instance;
    });
});
const getSession = () => instance;

exports.session = {
  createSession,
  getSession,
};
