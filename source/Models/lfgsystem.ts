import database from "../Config/database.js";

export default async function LfgSystem(): Promise<void> {
    try {
        // =========================
        // ENUMS
        // =========================
        await database.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_type t
                    JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE t.typname = 'lfg_role_type'
                ) THEN
                    CREATE TYPE lfg_role_type AS ENUM ('rank', 'role');
                END IF;
            END
            $$;
        `);


        // =========================
        // ROOT CONFIG (game per guild)
        // =========================
        await database.query(`
            CREATE TABLE IF NOT EXISTS lfg_games (
                id SERIAL PRIMARY KEY,
                guild_id BIGINT NOT NULL,
                game_name TEXT NOT NULL,

                category_channel_id BIGINT,
                manager_channel_id BIGINT,
                manager_message_id BIGINT,

                UNIQUE (guild_id, game_name)
            );

            CREATE INDEX IF NOT EXISTS idx_lfg_games_guild
            ON lfg_games(guild_id);
        `);

        // =========================
        // CHANNELS
        // =========================
        await database.query(`
            CREATE TABLE IF NOT EXISTS lfg_channels (
                id SERIAL PRIMARY KEY,
                game_id INT NOT NULL
                    REFERENCES lfg_games(id) ON DELETE CASCADE,

                name TEXT NOT NULL,
                discord_channel_id BIGINT UNIQUE,

                UNIQUE (game_id, name)
            );

            CREATE INDEX IF NOT EXISTS idx_lfg_channels_game
            ON lfg_channels(game_id);
        `);

        // =========================
        // GAMEMODES
        // =========================
        await database.query(`
            CREATE TABLE IF NOT EXISTS lfg_gamemodes (
                id SERIAL PRIMARY KEY,
                game_id INT NOT NULL
                    REFERENCES lfg_games(id) ON DELETE CASCADE,

                name TEXT NOT NULL,

                UNIQUE (game_id, name)
            );

            CREATE INDEX IF NOT EXISTS idx_lfg_gamemodes_game
            ON lfg_gamemodes(game_id);
        `);

        // =====================================
        // CHANNEL <===> GAMEMODE (many-to-many)
        // =====================================
        await database.query(`
            CREATE TABLE IF NOT EXISTS lfg_channel_gamemodes (
                channel_id INT
                    REFERENCES lfg_channels(id) ON DELETE CASCADE,
                gamemode_id INT
                    REFERENCES lfg_gamemodes(id) ON DELETE CASCADE,

                PRIMARY KEY (channel_id, gamemode_id)
            );
        `);

        // ===============================
        // ROLES
        // roles must be unique per guild
        // ===============================
        await database.query(`
            CREATE TABLE IF NOT EXISTS lfg_roles (
                id SERIAL PRIMARY KEY,

                guild_id BIGINT NOT NULL,
                game_id INT NOT NULL
                    REFERENCES lfg_games(id) ON DELETE CASCADE,

                role_id BIGINT NOT NULL,
                type lfg_role_type NOT NULL,

                UNIQUE (guild_id, role_id)
            );

            CREATE INDEX IF NOT EXISTS idx_lfg_roles_game
            ON lfg_roles(game_id);
        `);

        // =========================
        // POSTS (runtime)
        // =========================
        await database.query(`
            CREATE TABLE IF NOT EXISTS lfg_posts (
                id BIGSERIAL PRIMARY KEY,

                guild_id BIGINT NOT NULL,
                game_id INT NOT NULL
                    REFERENCES lfg_games(id) ON DELETE CASCADE,
                channel_id INT NOT NULL
                    REFERENCES lfg_channels(id) ON DELETE CASCADE,
                gamemode_id INT
                    REFERENCES lfg_gamemodes(id),

                message_id BIGINT NOT NULL UNIQUE,
                owner_id BIGINT NOT NULL,

                slots INT NOT NULL,
                description TEXT,
                
                created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::bigint,

                UNIQUE (guild_id, game_id, owner_id)
            );

            CREATE INDEX IF NOT EXISTS idx_lfg_posts_guild
            ON lfg_posts(guild_id);

            CREATE INDEX IF NOT EXISTS idx_lfg_posts_channel
            ON lfg_posts(channel_id);
        `);

        // =========================
        // POST <===> ROLES
        // =========================
        await database.query(`
            CREATE TABLE IF NOT EXISTS lfg_post_roles (
                post_id BIGINT
                    REFERENCES lfg_posts(id) ON DELETE CASCADE,
                role_id INT
                    REFERENCES lfg_roles(id) ON DELETE CASCADE,

                PRIMARY KEY (post_id, role_id)
            );
        `);

    } catch (error) {
        console.error(error);
        throw error;
    }
}
