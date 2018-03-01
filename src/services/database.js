const Promise = require('bluebird');
const sqlite3 = Promise.promisifyAll(require('sqlite3').verbose());
const humps = require('humps');

// open the database connection
let db = new sqlite3.Database('data/instagrow.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    throw err;
  }
});

const create = () => {
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
            instagram_id integer PRIMARY KEY,
            username text NOT NULL,
            last_interaction_at text DEFAULT NULL,
            latest_media_created_at text DEFAULT NULL,
            latest_media_id integer DEFAULT NULL,
            latest_media_url text DEFAULT NULL
          );`);
  console.log('Created Database successfully.');
};

const getAccountByInstagramId = (instagramId) => {
  let sql = `SELECT
                instagram_id,
                username,
                last_interaction_at,
                latest_media_created_at,
                latest_media_id,
                latest_media_url
              FROM
                accounts
              WHERE instagram_id=?`;

  return db.getAsync(sql, [instagramId]).then(row => humps.camelizeKeys(row));
};

const addAccount = (instagramId, username) => {
  const sql = `INSERT INTO accounts(instagram_id, username) VALUES(?, ?)`;
  return db.runAsync(sql, [instagramId, username]).then(() => {instagramId: instagramId, username: username});
}

const close = () => db.close((err) => {
  if (err) {
    return console.error(err.message);
  }
});

exports.handler = {
  create,
  addAccount,
  getAccountByInstagramId,
  close,
};
