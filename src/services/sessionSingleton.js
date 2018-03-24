const Client = require('instagram-private-api').V1;
const Promise = require('bluebird');

let instance = null;
const createSession = Promise.method((config) => {
  const device = new Client.Device(config.username);
  const storage = new Client.CookieFileStorage(__dirname + `/../../cookies/${config.username}.json`);

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
