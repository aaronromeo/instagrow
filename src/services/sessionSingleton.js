const Client = require('instagram-private-api').V1;
const config = require("../../config.json");

const device = new Client.Device(config.username);
const storage = new Client.CookieFileStorage(__dirname + `/../../cookies/${config.username}.json`);

const session = Client.Session.create(device, storage, config.username, config.password)
  .then((session) => {
    return session
  });

exports.getSession = session;
