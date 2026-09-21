import database from "../Config/database.js";

export default async function AntiAltGuardSystem(): Promise<void> {
    try {
        await database.query(`
                CREATE TABLE IF NOT EXISTS antialtguard_setup (
                    id SERIAL PRIMARY KEY,
                    guild BIGINT NOT NULL UNIQUE,
                    category BIGINT NOT NULL,
                    verification_channel BIGINT NOT NULL,
                    verification_message_menu BIGINT NOT NULL,
                    assessment_channel BIGINT NOT NULL,
                    verified_role BIGINT NOT NULL
                );
            `);

    } catch (error) {
        console.error(error);
        throw error;
    }
}