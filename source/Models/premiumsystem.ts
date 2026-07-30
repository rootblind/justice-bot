import database from '../Config/database.js';

export default async function PremiumKey(): Promise<void> {
    try {

        /**
         * premiumkey table
         */
        await database.query(
            `CREATE TABLE IF NOT EXISTS premiumkey (
              id SERIAL PRIMARY KEY,
              code BYTEA NOT NULL UNIQUE,
              tier INT NOT NULL DEFAULT 0 CHECK (tier >= 0),
              guild BIGINT NOT NULL,
              generatedby BIGINT NOT NULL,
              createdat BIGINT NOT NULL,
              expiresat BIGINT NOT NULL,
              usesnumber INT NOT NULL CHECK (usesnumber >= 0),
              dedicateduser BIGINT
            );`
        );


        /**
         * premium member table
         */

        await database.query(
            `
            CREATE TABLE IF NOT EXISTS premiummember(
                id SERIAL PRIMARY KEY,
                member BIGINT NOT NULL,
                guild BIGINT NOT NULL,
                premiumkey_id INT NOT NULL,

                CONSTRAINT unique_premium_guild_member UNIQUE (guild, member),
                CONSTRAINT fk_premiumkey
                    FOREIGN KEY (premiumkey_id)
                    REFERENCES premiumkey(id)
                    ON DELETE CASCADE
            );
            `
        );

        /**
         * premium custom role
         */
        await database.query(
            `
            CREATE TABLE IF NOT EXISTS premium_custom_role(
                premiummember_id INT PRIMARY KEY,
                role BIGINT NOT NULL,

                CONSTRAINT fk_premiummember
                    FOREIGN KEY (premiummember_id)
                    REFERENCES premiummember(id)
                    ON DELETE CASCADE
            );
            `
        )
    } catch (error) {
        console.error(error);
        throw error;
    }
}