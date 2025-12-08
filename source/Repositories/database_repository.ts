import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { ColumnValuePair } from "../Interfaces/database_types.js";

/**
 * Table generic methods
 */
class DatabaseRepository {
    /**
     * Delete all rows in the table of the specified guild.
     * If the table doesn't have a 'guild' column, this function does nothing.
     * @param table Table name
     * @param guildId Guild Snowflake
     */
    async wipeGuildFromTable(table: string, guildId: Snowflake): Promise<void> {
        const guildColumnExists = await database.query(
            `SELECT 1 FROM information_schema.columns
                WHERE table_schema='public'
                    AND table_name=$1
                    AND column_name='guild'`,
            [table]
        );

        if(guildColumnExists.rowCount !== null && guildColumnExists.rowCount > 0) {
            await database.query(
                `DELETE FROM ${table} WHERE guild=$1`, [guildId]
            );
        }
    }

    /**
     * 
     * @returns String array of all table names
     */
    async getTables(): Promise<string[]> {
        const {rows: result} = await database.query(
            `SELECT table_name FROM information_schema.tables
                WHERE table_schema='public'
                    AND table_type='BASE TABLE'`
        );

        if(result.length) {
            return result;
        } else {
            throw new Error("Failed to fetch database table names!");
        }
    }

    /**
     * Deletes all rows from the table of the given guild and property
     * @param guildId Guild Snowflake
     * @param table Database table name
     * @param property The column with the value to be wiped
     */
    async wipeGuildRowsWithProperty(guildId: Snowflake, table: string, property: ColumnValuePair): Promise<void> {
        await database.query(
            `DELETE FROM ${table} WHERE guild=$1 AND ${property.column}=$2`,
            [guildId, property.value]
        );
    }

    /**
     * 
     * @param property ColumnValuePair
     * @returns String array of table names with the specific column of the given value 
     */
    async getTablesWithColumnValue(property: ColumnValuePair): Promise<string[]> {
        const {rows: tables} = await database.query(
            `SELECT table_name FROM information_scheme.tables
                WHERE table_schema='public AND table_type='BASE TABLE'
                    AND column_name=$1`,
            [property.column]
        );

        const matchingTables: string[] = [];

        for(const { table_name } of tables) {
            const { rowCount } = await database.query(
                `SELECT 1 FROM ${table_name} WHERE ${property.column}=$1 LIMIT 1`,
                [property.value]
            );

            if(rowCount !== null && rowCount > 0) {
                matchingTables.push(table_name);
            }
        }

        return matchingTables;
    }
}

const DatabaseRepo = new DatabaseRepository();
export default DatabaseRepo;