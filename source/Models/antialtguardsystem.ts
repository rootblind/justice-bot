import database from "../Config/database.js";

export default async function AntiAltGuardSystem(): Promise<void> {
    try {
        await database.query(`
                CREATE TABLE IF NOT EXISTS antialtguard_setup (
                    id SERIAL PRIMARY KEY,
                    guild BIGINT NOT NULL UNIQUE,
                    category BIGINT NOT NULL UNIQUE,
                    verification_channel BIGINT NOT NULL UNIQUE,
                    verification_message_menu BIGINT NOT NULL UNIQUE,
                    assessment_channel BIGINT NOT NULL UNIQUE,
                    verified_role BIGINT NOT NULL UNIQUE
                );

                CREATE TABLE IF NOT EXISTS antialtguard_pending_verification (
                    messageid BIGINT PRIMARY KEY,
                    channel BIGINT NOT NULL
                        REFERENCES antialtguard_setup(assessment_channel)
                        ON DELETE CASCADE,
                    member BIGINT NOT NULL,
                    expiresat BIGINT NOT NULL
                );
            `);

    } catch (error) {
        console.error(error);
        throw error;
    }
}