// Here a pool connection is established between the bot and the database.
// An object and a method are exported for convenience.

const { Pool, Client } = require("pg");
const { config } = require("dotenv");
config();

// The pool connection to the database
const poolConnection = new Pool({
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  port: process.env.DBPORT,
  password: process.env.DBPASS,
  database: process.env.DBNAME,
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  allowExitOnIdle: false,
});

function executeQuery(query) {
  return new Promise((resolve, reject) => {
      poolConnection.query(query)
          .then(result => resolve(result.rows))
          .catch(error => {
              console.error("Error executing query:", error);
              reject(error); // Reject the promise with the error
          });
  });
}


module.exports = {
    poolConnection,
    executeQuery
};
function testDB() {
  (async () => {
    const { rows } = await poolConnection.query(`SELECT * FROM public."Test"`);
    rows.map((row) => console.log(row));
  })();
}

//testDB(); // testing the connection to the database

/*  Connecting to the database and sending queries
const poolConnection = require('./kayle-db.js');

(async () => {
    await poolConnection.query(`SELECT * FROM public."Test"`, (err, result) => {
        if (err) throw err;
        console.log(result.rows);
    });
})();


    Sending queries through the executeQuery method

    const {executeQuery} = require('./kayle-db');
(async () => {
    const x = await executeQuery(`SELECT * FROM public."Test"`);
    console.log(x);
})();

using poolConnection might be better for controlling what is returned from the query
using executeQuery might be better for recieving the rows without having to catch errors since
the method does it.

*/
