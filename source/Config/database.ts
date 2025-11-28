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