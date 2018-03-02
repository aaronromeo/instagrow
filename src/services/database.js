const Promise = require('bluebird');
const sqlite3 = Promise.promisifyAll(require('sqlite3').verbose());
const humps = require('humps');
const moment = require('moment');
const config = require("../../config.json");

const INTERACTION_DELTA_IN_DAYS = 3;

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
            last_interaction_at integer DEFAULT NULL,
            latest_media_created_at integer DEFAULT NULL,
            latest_media_id integer DEFAULT NULL,
            latest_media_url text DEFAULT NULL
          );`);
  console.log('Created Database successfully.');
};

const getAccountsPossiblyRequiringInteraction = () => {
  const sql = `SELECT
                instagram_id,
                username,
                last_interaction_at,
                latest_media_created_at,
                latest_media_id,
                latest_media_url
              FROM
                accounts
              WHERE
                last_interaction_at < ?
              OR last_interaction_at IS NULL`;

  return db.allAsync(sql, [moment().subtract(INTERACTION_DELTA_IN_DAYS, 'd')])
          .then(row => humps.camelizeKeys(row));
};

const getAccountsToBeLiked = () => {
  const maximumAgeOfContentConsidered = moment().subtract(1, 'w');
  const sql = `SELECT
                instagram_id,
                username,
                last_interaction_at,
                latest_media_created_at,
                latest_media_id,
                latest_media_url
              FROM
                accounts
              WHERE
                (
                  last_interaction_at IS NULL
                  AND latest_media_created_at IS NOT NULL
                  AND latest_media_created_at > ?
                )
              OR
                (
                  latest_media_created_at > ?
                  AND last_interaction_at < latest_media_created_at
                  AND last_interaction_at < ?
                )
              ORDER BY latest_media_created_at
            `;

  return db.allAsync(
    sql, [
      maximumAgeOfContentConsidered.valueOf(),
      maximumAgeOfContentConsidered.valueOf(),
      moment().subtract(INTERACTION_DELTA_IN_DAYS, 'd'),
    ]
  ).then(row => humps.camelizeKeys(row));
};

const getAccountByInstagramId = (instagramId) => {
  let sql = `SELECT
                instagram_id,
                username,
                last_interaction_at,
                latest_media_id,
                latest_media_url,
                latest_media_created_at
              FROM
                accounts
              WHERE instagram_id=?`;

  return db.getAsync(sql, [instagramId]).then(row => humps.camelizeKeys(row));
};

const addAccountOrUpdateUsername = (instagramId, username) => {
  return getAccountByInstagramId(instagramId)
    .then((account) => {
      let sql;
      if (account) {
        sql = `UPDATE accounts SET username=? WHERE instagram_id=?`;
      } else {
        sql = `INSERT INTO accounts(username, instagram_id) VALUES(?, ?)`;
      }
      return db.runAsync(sql, [username, instagramId]).then(() => {
        return {instagramId: instagramId, username: username}
      });
    })
}

const updateLatestMediaDetails = (instagramId, latestMediaId, latestMediaUrl, latestMediaCreatedAt) => {
  const sql = `UPDATE accounts
                SET
                  latest_media_id=?,
                  latest_media_url=?,
                  latest_media_created_at=?
                WHERE instagram_id=?`;
  return db.runAsync(sql, [latestMediaId, latestMediaUrl, latestMediaCreatedAt, instagramId]).then(() => {
    return {instagramId: instagramId}
  });
}

const updateLastInteration = (instagramId, latestInteraction) => {
  const sql = `UPDATE accounts
                SET
                  last_interaction_at=?
                WHERE instagram_id=?`;
  return db.runAsync(sql, [latestInteraction, instagramId]).then(() => {
    return {instagramId: instagramId}
  });
}

const close = () => db.close((err) => {
  if (err) {
    return console.error(err.message);
  }
});

exports.handler = {
  create,
  addAccountOrUpdateUsername,
  getAccountsPossiblyRequiringInteraction,
  getAccountByInstagramId,
  getAccountsToBeLiked,
  updateLatestMediaDetails,
  updateLastInteration,
  close,
};
