import database from '../Config/database.js';

export default async function TicketSupportSystem(): Promise<void> {
    try {
        await database.query(
            `CREATE TABLE IF NOT EXISTS ticketmanager(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                category BIGINT NOT NULL,
                channel BIGINT NOT NULL,
                message BIGINT NOT NULL,

                CONSTRAINT ticket_manager_guild UNIQUE (guild)
            )`
        );

        await database.query(
            `CREATE TABLE IF NOT EXISTS ticketsubject(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                subject TEXT NOT NULL,
                description TEXT NOT NULL,

                UNIQUE (guild, subject)
            )`
        );

        await database.query(
            `CREATE TABLE IF NOT EXISTS openticket(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                channel BIGINT NOT NULL,
                message BIGINT NOT NULL,
                member BIGINT NOT NULL,
                subject TEXT NOT NULL,
                timestamp BIGINT NOT NULL,

                UNIQUE (guild, member)
            )`
        );
    } catch (error) {
        console.error(error);
        throw error;
    }
}