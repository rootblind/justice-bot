/**
 * Postgresql is used as the database using the automatic pool connection way of sending SQL requests.
 * Could be replaced with any other database as long as database.js exports something that has the expected 
 * behavior that Postgresql has. Meaning that something like
 * database.query("SQL CODE", [array of elements to replace the $1, $2, ... $n inside the sql code], (error, result) => {})
 * If that is not possible, then Repositories must be modified to the expected behavior of the database.
 */
import { Pool } from "pg";
import { get_env_var } from "../utility_modules/utility_methods.js";

const poolConnection = new Pool({
  host: get_env_var("DBHOST"),
  user: get_env_var("DBUSER"),
  port: Number(get_env_var("DBPORT")),
  password: get_env_var("DBPASS"),
  database: get_env_var("DBNAME"),
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  allowExitOnIdle: false,
});


// eslint-disable-next-line @typescript-eslint/no-unused-vars
function testDB() {
  (async () => {
    const { rows } = await poolConnection.query(`SELECT * FROM public."Test"`);
    rows.map((row) => console.log(row));
  })();
}

//testDB(); // testing the connection to the database

export default poolConnection;