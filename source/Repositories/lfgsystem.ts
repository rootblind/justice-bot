import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import {
    LfgChannel,
    LfgChannelTable,
    LfgGamemode,
    LfgGamemodeTable,
    LfgGameTable,
    LfgPostAndRoleIds,
    LfgPostFullRow,
    LfgPostTable,
    LfgPostWithChannelTable,
    LfgRole,
    LfgRoleTable,
    LfgRoleType,
    LfgSystemConfig
} from "../Interfaces/lfg_system.js";
import { SelfCache } from "../Config/SelfCache.js";
import { timestampNow } from "../utility_modules/utility_methods.js";

const ONE_DAY_MILLISECONDS = 24 * 60 * 60_000;

///////////////// caches /////////////////
const systemConfigCache = new SelfCache<string, LfgSystemConfig>(ONE_DAY_MILLISECONDS); // 24h persistence key: guild_id
//////////////////////////////////////////

export const DEFAULT_LFG_COOLDOWN = 15 * 60; // 15min
export type LfgCooldownEntry = {
    expiresAt: number;
};
export const lfgCooldowns = new Map<string, LfgCooldownEntry>();

class LfgCache {
    // key = serial primary key as string
    readonly gameCache = new SelfCache<string, LfgGameTable>();
    readonly channelCache = new SelfCache<string, LfgChannelTable>();
    readonly gmCache = new SelfCache<string, LfgGamemodeTable>();
    readonly roleCache = new SelfCache<string, LfgRoleTable>();
    readonly postCache = new SelfCache<string, LfgPostTable>(60 * 60_000);
}

class LfgSystemRepository {
    /// cooldowns
    private key(guildId: Snowflake, memberId: Snowflake, gameId: number) {
        return `${guildId}:${memberId}:${gameId}`;
    }

    private systemCache = new LfgCache();
    /**
     * Set the member on cooldown for the specific guild-game
     * 
     * Cooldown in seconds.
     * 
     * @returns The expiration timestamp in seconds
     */
    async setCooldown(guildId: Snowflake, memberId: Snowflake, gameId: number): Promise<number> {
        const config = await this.getSystemConfigForGuild(guildId);
        if (!config) return 0;

        const expiresAt = timestampNow() + config.post_cooldown;
        lfgCooldowns.set(this.key(guildId, memberId, gameId), { expiresAt: expiresAt });

        return expiresAt;
    }
    /**
     * Remove the member's cooldown inside the guild-game
     */
    removeCooldown(guildId: Snowflake, memberId: Snowflake, gameId: number) {
        lfgCooldowns.delete(this.key(guildId, memberId, gameId));
    }
    /**
     * @returns The expiration timestamp in seconds or undefined if the member is not on cooldown 
     * for the specified guild-game 
     */
    getCooldown(guildId: Snowflake, memberId: Snowflake, gameId: number): number | undefined {
        const entry = lfgCooldowns.get(this.key(guildId, memberId, gameId));
        if (!entry) return undefined;

        // clean up if the cooldown expired
        if (entry.expiresAt <= timestampNow()) {
            lfgCooldowns.delete(this.key(guildId, memberId, gameId));
            return undefined;
        }

        return entry.expiresAt;
    }
    ///////////////////////////////////////////
    // lfg_system_config related repositories
    ///////////////////////////////////////////
    async initSystemConfig(guildId: Snowflake) {
        await database.query(
            `INSERT INTO lfg_system_config (guild_id)
            VALUES ($1)
            ON CONFLICT (guild_id)
            DO UPDATE SET
                force_voice = TRUE,
                post_cooldown = ${DEFAULT_LFG_COOLDOWN};`,
            [guildId]
        );

        // caching
        systemConfigCache.set(guildId, {
            guild_id: guildId,
            force_voice: true,
            post_cooldown: DEFAULT_LFG_COOLDOWN
        });
    }
    async deleteSystemConfig(guildId: Snowflake) {
        await database.query(`DELETE FROM lfg_system_config WHERE guild_id=$1`, [guildId]);
        systemConfigCache.delete(guildId);
    }
    /**
     * The cooldown must be in seconds
     */
    async updateSystemCooldown(guildId: Snowflake, cooldown: number): Promise<LfgSystemConfig> {
        const { rows: data } = await database.query<LfgSystemConfig>(
            `UPDATE lfg_system_config SET post_cooldown=$2 WHERE guild_id=$1
            RETURNING *;`,
            [guildId, cooldown]
        );

        systemConfigCache.set(guildId, {
            guild_id: guildId,
            force_voice: data[0]!.force_voice,
            post_cooldown: data[0]!.post_cooldown
        });
        return data[0]!;
    }

    async toggleSystemForceVoice(guildId: Snowflake, force_voice: boolean): Promise<LfgSystemConfig> {
        const { rows: data } = await database.query<LfgSystemConfig>(
            `UPDATE lfg_system_config SET force_voice=$2 WHERE guild_id=$1
            RETURNING *;`,
            [guildId, force_voice]
        )

        systemConfigCache.set(guildId, {
            guild_id: guildId,
            force_voice: data[0]!.force_voice,
            post_cooldown: data[0]!.post_cooldown
        });

        return data[0]!;
    }

    async getSystemConfigForGuild(guildId: Snowflake): Promise<LfgSystemConfig> {
        const cache = systemConfigCache.get(guildId);
        if (cache) return cache;

        const { rows: data } = await database.query<LfgSystemConfig>(
            `SELECT * FROM lfg_system_config WHERE guild_id=$1`, [guildId]
        );

        if (data && data[0]) {
            systemConfigCache.set(guildId, {
                guild_id: guildId,
                force_voice: data[0].force_voice,
                post_cooldown: data[0].post_cooldown
            });
            return data[0];
        } else {
            await this.initSystemConfig(guildId);
            return {
                guild_id: guildId,
                force_voice: true,
                post_cooldown: DEFAULT_LFG_COOLDOWN
            }
        }
    }

    ///////////////////////////////////
    // lfg_games related repositories
    ///////////////////////////////////
    /**
     * @returns All games for all guilds 
     */
    async getGamesTable(): Promise<LfgGameTable[]> {
        const { rows: data } = await database.query<LfgGameTable>(
            `SELECT * FROM lfg_games;`
        );

        // populate the cache
        for (const row of data) {
            this.systemCache.gameCache.set(String(row.id), row);
        }

        return data;
    }
    /**
     * Register a game by guild-name and retrieve the inserted data
     * 
     * Game names will be stored as upper case.
     */
    async registerNewGame(guildId: Snowflake, gameName: string): Promise<LfgGameTable> {
        const { rows: result } = await database.query<LfgGameTable>(
            `INSERT INTO lfg_games (guild_id, game_name) VALUES ($1, $2)
                ON CONFLICT (guild_id, game_name)
                DO UPDATE SET game_name = EXCLUDED.game_name
                RETURNING *;`,
            [guildId, gameName.toUpperCase()]
        )

        this.systemCache.gameCache.set(String(result[0]!.id), result[0]!);

        return result[0]!;
    }

    /**
     * Fetch the row of the game in the given guild
     */
    async getGame(guildId: Snowflake, gameName: string): Promise<LfgGameTable | null> {
        const cache = this.systemCache.gameCache.getByValue(
            (value) => value.guild_id === guildId && value.game_name === gameName
        );

        if (cache && cache[0]) return cache[0];

        const { rows: data } = await database.query<LfgGameTable>(
            `SELECT * FROM lfg_games WHERE guild_id=$1 AND game_name=$2`,
            [guildId, gameName.toUpperCase()]
        );

        if (data && data[0]) {
            this.systemCache.gameCache.set(String(data[0].id), data[0]);
            return data[0];
        } else {
            return null;
        }
    }

    /**
     * Fetch the game row by id
     */
    async getGameById(gameId: number): Promise<LfgGameTable | null> {
        const cache = this.systemCache.gameCache.get(String(gameId));
        if (cache) return cache;

        const { rows: data } = await database.query<LfgGameTable>(
            `SELECT * FROM lfg_games WHERE id=$1`,
            [gameId]
        );

        if (data && data[0]) {
            this.systemCache.gameCache.set(String(data[0].id), data[0]);
            return data[0];
        } else {
            return null;
        }
    }

    /**
     * Fetch all registered games within this guild
     */
    async getGuildGames(guildId: Snowflake): Promise<LfgGameTable[]> {
        const cache = this.systemCache.gameCache.getByValue((value) => value.guild_id === guildId);
        if (cache && cache.length > 0) return cache;

        const { rows: data } = await database.query<LfgGameTable>(
            `SELECT * FROM lfg_games WHERE guild_id=$1`,
            [guildId]
        );

        for (const row of data) {
            this.systemCache.gameCache.set(String(row.id), row);
        }

        return data;
    }

    async deleteGamesBulk(ids: number[]) {
        if (ids.length === 0) return;
        const idSet = new Set(ids);

        await database.query(`DELETE FROM lfg_games WHERE id = ANY($1)`, [ids]);

        this.systemCache.gameCache.deleteByValue(
            (_, key) => idSet.has(Number(key))
        );

        this.systemCache.channelCache.deleteByValue(
            (value) => idSet.has(value.game_id)
        );

        this.systemCache.gmCache.deleteByValue(
            (value) => idSet.has(value.game_id)
        )

        this.systemCache.roleCache.deleteByValue(
            (value) => idSet.has(value.game_id)
        );

        this.systemCache.postCache.deleteByValue(
            (value) => idSet.has(value.game_id)
        );

    }

    /**
     * Delete the game row from the guild if the component id matches the category, interface channel or interface message snowflake
     * @param componentId 
     */
    async onGameComponentDelete(guildId: Snowflake, componentId: Snowflake) {
        const { rows: result } = await database.query<LfgGameTable>(
            `DELETE FROM lfg_games WHERE guild_id=$1
                AND (category_channel_id=$2 OR manager_channel_id=$2 OR manager_message_id=$2)
            RETURNING id;`,
            [guildId, componentId]
        );

        if (result.length === 0) return;

        const deletedIds = new Set<number>(result.map(r => r.id));

        this.systemCache.gameCache.deleteByValue((_, key) => deletedIds.has(Number(key)));
        this.systemCache.channelCache.deleteByValue((value) => deletedIds.has(value.game_id));
        this.systemCache.gmCache.deleteByValue((value) => deletedIds.has(value.game_id));
        this.systemCache.roleCache.deleteByValue((value) => deletedIds.has(value.game_id));
        this.systemCache.postCache.deleteByValue((value) => deletedIds.has(value.game_id));
    }

    async deleteAllGamesFromGuild(guildId: Snowflake) {
        const { rows: result } = await database.query<LfgGameTable>(
            `DELETE FROM lfg_games WHERE guild_id=$1
            RETURNING id;`,
            [guildId]
        );

        if (result.length === 0) return;
        const deletedIds = new Set<number>(result.map(r => r.id));
        this.systemCache.gameCache.deleteByValue((_, key) => deletedIds.has(Number(key)));
        this.systemCache.channelCache.deleteByValue((value) => deletedIds.has(value.game_id));
        this.systemCache.gmCache.deleteByValue((value) => deletedIds.has(value.game_id));
        this.systemCache.roleCache.deleteByValue((value) => deletedIds.has(value.game_id));
        this.systemCache.postCache.deleteByValue((value) => deletedIds.has(value.game_id));
    }

    /**
     * Updates the game row by providing data for the category, manager channel and manager message Snowflakes
     * 
     * Before calling this method, make sure to fetch the game row, assign the Snowflakes to the object and parse it back here.
     * 
     * @returns The updated row
     */
    async setGameSnowflakes(game: LfgGameTable): Promise<LfgGameTable> {
        const { rows: response } = await database.query<LfgGameTable>(
            `UPDATE lfg_games SET category_channel_id=$2, manager_channel_id=$3, manager_message_id=$4 WHERE id=$1
            RETURNING *;`,
            [game.id, game.category_channel_id, game.manager_channel_id, game.manager_message_id]
        );

        this.systemCache.gameCache.set(String(response[0]!.id), response[0]!);
        return response[0]!;
    }

    /**
     * Delete a game based on its database ID
     */
    async deleteGame(id: number) {
        await database.query(`DELETE FROM lfg_games WHERE id=$1`, [id]);
        this.systemCache.gameCache.delete(String(id));
        this.systemCache.channelCache.deleteByValue((value) => value.game_id === id);
        this.systemCache.gmCache.deleteByValue((value) => value.game_id === id);
        this.systemCache.roleCache.deleteByValue((value) => value.game_id === id);
        this.systemCache.postCache.deleteByValue((value) => value.game_id === id);
    }

    /**
     * Fetch the game row based on the message Snowflake associated with its interface manager
     * @returns LfgGameTable object or null if there is no game associated with the guild-message pair
     */
    async getGameByInterface(guildId: Snowflake, messageId: Snowflake): Promise<LfgGameTable | null> {
        const cache = this.systemCache.gameCache.getByValue(
            (value) => value.guild_id === guildId && value.manager_message_id === messageId
        );

        if (cache && cache[0]) return cache[0];

        const { rows: data } = await database.query<LfgGameTable>(
            `SELECT * FROM lfg_games WHERE guild_id=$1 AND manager_message_id=$2`,
            [guildId, messageId]
        );

        if (data && data[0]) {
            this.systemCache.gameCache.set(String(data[0].id), data[0]);
            return data[0];
        } else {
            return null;
        }
    }

    //////////////////////////////////////
    // lfg_channels related repositories
    //////////////////////////////////////
    /**
     * 
     * @param channel LfgChannel with the data to be registered.
     * @returns The LfgChannelTable object inserted into the database.
     */
    async registerChannel(channel: LfgChannel): Promise<LfgChannelTable> {
        const { rows: response } = await database.query<LfgChannelTable>(
            `INSERT INTO lfg_channels (game_id, name, discord_channel_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (game_id, name)
                DO UPDATE SET discord_channel_id = EXCLUDED.discord_channel_id
                RETURNING *;`,
            [channel.game_id, channel.name, channel.discord_channel_id]
        );

        this.systemCache.channelCache.set(String(response[0]!.id), response[0]!);

        return response[0]!;
    }

    /**
     * @returns LfgChannelTable array of all channels associated with that specific game id  
     */
    async getLfgChannelsByGame(gameId: number): Promise<LfgChannelTable[]> {
        const cache = this.systemCache.channelCache.getByValue((value) => value.game_id === gameId);
        if (cache && cache.length > 0) return cache;

        const { rows: data } = await database.query<LfgChannelTable>(
            `SELECT * FROM lfg_channels WHERE game_id=$1`, [gameId]
        );

        for (const row of data) {
            this.systemCache.channelCache.set(String(row.id), row);
        }
        return data;
    }

    async deleteChannel(lfgChannelId: number) {
        await database.query(`DELETE FROM lfg_channels WHERE id=$1`, [lfgChannelId]);
        this.systemCache.channelCache.delete(String(lfgChannelId));
        this.systemCache.postCache.deleteByValue((value) => value.channel_id === lfgChannelId);
    }

    async deleteChannelsBulk(ids: number[]) {
        await database.query(`DELETE FROM lfg_channels WHERE id=ANY($1)`, [ids]);

        const idSet = new Set(ids);
        this.systemCache.channelCache.deleteByValue((_, key) => idSet.has(Number(key)));
        this.systemCache.postCache.deleteByValue((value) => idSet.has(value.channel_id));
    }

    async deleteChannelBySnowflake(channelId: Snowflake) {
        const { rows: result } = await database.query<LfgChannelTable>(
            `DELETE FROM lfg_channels WHERE discord_channel_id=$1
            RETURNING id;`,
            [channelId]
        );

        if (result.length === 0) return;
        const deletedIds = new Set<number>(result.map(r => r.id));
        this.systemCache.channelCache.deleteByValue((value) => value.discord_channel_id === channelId);
        this.systemCache.postCache.deleteByValue((value) => deletedIds.has(value.channel_id));
    }

    async getLfgChannelBySnowflake(channelId: Snowflake): Promise<LfgChannelTable | null> {
        const cache = this.systemCache.channelCache.getByValue((value) => value.discord_channel_id === channelId);
        if (cache && cache[0]) return cache[0];

        const { rows: data } = await database.query<LfgChannelTable>(
            `SELECT * FROM lfg_channels WHERE discord_channel_id=$1`,
            [channelId]
        );

        if (data && data[0]) {
            this.systemCache.channelCache.set(String(data[0].id), data[0]);
            return data[0];
        } else {
            return null;
        }
    }

    //////////////////////////////////////
    // lfg_gamemodes related repositories
    //////////////////////////////////////
    /**
     * 
     * @param gamemode The LfgGamemode object that contains the data to be registered
     * @returns The row inserted as LfgGamemodeTable
     */
    async registerGamemode(gamemode: LfgGamemode): Promise<LfgGamemodeTable> {
        const { rows: response } = await database.query<LfgGamemodeTable>(
            `INSERT INTO lfg_gamemodes (game_id, name)
                VALUES($1, $2)
                ON CONFLICT (game_id, name)
                DO UPDATE SET name = EXCLUDED.name
                RETURNING *;`,
            [gamemode.game_id, gamemode.name]
        );

        this.systemCache.gmCache.set(String(response[0]!.id), response[0]!);
        return response[0]!;
    }

    async getGamemodesOfGameId(gameId: number): Promise<LfgGamemodeTable[]> {
        const cache = this.systemCache.gmCache.getByValue((value) => value.game_id === gameId);
        if (cache && cache.length > 0) return cache;

        const { rows: data } = await database.query<LfgGamemodeTable>(
            `SELECT * FROM lfg_gamemodes WHERE game_id=$1`,
            [gameId]
        )

        for (const row of data) {
            this.systemCache.gmCache.set(String(row.id), row);
        }

        return data;
    }

    async deleteGamemode(id: number) {
        await database.query(`DELETE FROM lfg_gamemodes WHERE id=$1`, [id]);
        this.systemCache.gmCache.delete(String(id));
    }

    async deleteGamemodesBulk(ids: number[]) {
        await database.query(`DELETE FROM lfg_gamemodes WHERE id=ANY($1)`, [ids]);

        const idSet = new Set(ids);
        this.systemCache.gmCache.deleteByValue((_, key) => idSet.has(Number(key)));
    }

    async getGamemodeByName(game_id: number, gamemode: string): Promise<LfgGamemodeTable | null> {
        const cache = this.systemCache.gmCache.getByValue((value) => value.name === gamemode && value.game_id === game_id);
        if (cache && cache[0]) return cache[0];
        const { rows: data } = await database.query<LfgGamemodeTable>(
            `SELECT * FROM lfg_gamemodes WHERE game_id=$1 AND name=$2`,
            [game_id, gamemode.toUpperCase()]
        );

        if (data && data[0]) {
            this.systemCache.gmCache.set(String(data[0].id), data[0]);
            return data[0];
        } else {
            return null;
        }
    }

    //////////////////////////////////////
    // lfg_roles related repositories
    //////////////////////////////////////
    /**
     * 
     * @param role as LfgRole object
     * @returns The row inserted as LfgRoleTable object
     */
    async registerRole(role: LfgRole): Promise<LfgRoleTable> {
        const { rows: response } = await database.query<LfgRoleTable>(
            `INSERT INTO lfg_roles (guild_id, game_id, role_id, type)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (guild_id, role_id)
                DO UPDATE SET type = EXCLUDED.type
                RETURNING *;`,
            [role.guild_id, role.game_id, role.role_id, role.type]
        );

        this.systemCache.roleCache.set(String(response[0]!.id), response[0]!);
        return response[0]!;
    }

    async registerRolesBulk(roles: LfgRole[]): Promise<LfgRoleTable[]> {
        if (roles.length === 0) return [];

        const guildIds = roles.map(r => r.guild_id);
        const gameIds = roles.map(r => r.game_id);
        const roleIds = roles.map(r => r.role_id);
        const types = roles.map(r => r.type);

        const { rows } = await database.query<LfgRoleTable>(
            `
            INSERT INTO lfg_roles (guild_id, game_id, role_id, type)
            SELECT *
            FROM UNNEST(
                $1::bigint[],
                $2::int[],
                $3::bigint[],
                $4::lfg_role_type[]
            )
            ON CONFLICT (guild_id, role_id)
            DO UPDATE SET type = EXCLUDED.type
            RETURNING *;
            `,
            [guildIds, gameIds, roleIds, types]
        );

        for (const row of rows) {
            this.systemCache.roleCache.set(String(row.id), row);
        }

        return rows;
    }


    /**
     * 
     * @returns All type role roles for the game
     */
    async getGameRoles(gameId: number): Promise<LfgRoleTable[]> {
        const cache = this.systemCache.roleCache.getByValue(
            (value) => value.game_id === gameId && value.type === "role"
        );
        if (cache && cache.length > 0) return cache;

        const { rows: data } = await database.query<LfgRoleTable>(
            `SELECT * FROM lfg_roles WHERE game_id=$1 AND type='role';`,
            [gameId]
        );
        for (const row of data) {
            this.systemCache.roleCache.set(String(row.id), row);
        }
        return data;
    }

    /**
     * @returns All type rank roles for the game 
     */
    async getGameRanks(gameId: number): Promise<LfgRoleTable[]> {
        const cache = this.systemCache.roleCache.getByValue(
            (value) => value.game_id === gameId && value.type === "rank"
        );
        if (cache && cache.length > 0) return cache;
        const { rows: data } = await database.query<LfgRoleTable>(
            `SELECT * FROM lfg_roles WHERE game_id=$1 AND type='rank';`,
            [gameId]
        );

        for (const row of data) {
            this.systemCache.roleCache.set(String(row.id), row);
        }

        return data;
    }

    async getGameLfgRolesByType(gameId: number, type: LfgRoleType): Promise<LfgRoleTable[]> {
        const cache = this.systemCache.roleCache.getByValue(
            (value) => value.game_id === gameId && value.type === type
        );

        if (cache && cache.length > 0) return cache;

        const { rows: data } = await database.query<LfgRoleTable>(
            `SELECT * FROM lfg_roles WHERE game_id=$1 AND type=$2`,
            [gameId, type]
        );

        for (const row of data) {
            this.systemCache.roleCache.set(String(row.id), row);
        }
        return data;
    }

    async getAllGameLfgRoles(gameId: number): Promise<LfgRoleTable[]> {
        const cache = this.systemCache.roleCache.getByValue((value) => value.game_id === gameId);
        if (cache && cache.length > 0) return cache;
        const { rows: data } = await database.query<LfgRoleTable>(
            `SELECT * FROM lfg_roles WHERE game_id=$1`,
            [gameId]
        );

        for (const row of data) {
            this.systemCache.roleCache.set(String(row.id), row);
        }

        return data;
    }

    async deleteGameRolesByType(gameId: number, type: LfgRoleType) {
        await database.query(
            `DELETE FROM lfg_roles WHERE game_id=$1 AND type=$2`,
            [gameId, type]
        );

        this.systemCache.roleCache.deleteByValue(
            (value) => value.game_id === gameId && value.type === type
        );
    }

    async deleteLfgRolesBySnowflake(roleIds: string[]) {
        await database.query(
            `DELETE FROM lfg_roles WHERE role_id=ANY($1)`, [roleIds]
        );
        const idSet = new Set(roleIds);
        this.systemCache.roleCache.deleteByValue(
            (value) => idSet.has(value.role_id)
        );
    }

    async deleteOneLfgRoleBySnowflake(roleId: Snowflake) {
        await database.query(`DELETE FROM lfg_roles WHERE role_id=$1`, [roleId]);
        this.systemCache.roleCache.deleteByValue((value) => value.role_id === roleId);
    }

    //////////////////////////////////////
    // lfg-posts repositories
    //////////////////////////////////////

    /**
     * 
     * @param data LfgPostAndRoleIds object. Contains the post that must be registered and attaches the roles and ranks if any
     * @returns The LfgPostTable inserted
     */
    async registerPost(data: LfgPostAndRoleIds): Promise<LfgPostTable> {
        const { post, attachedRoleIds } = data;

        // register post
        const { rows: postResult } = await database.query<LfgPostTable>(
            `INSERT INTO lfg_posts
                    (guild_id, game_id, channel_id, gamemode_id,
                     message_id, owner_id, slots, description)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                ON CONFLICT (guild_id, game_id, owner_id)
                DO UPDATE SET
                    channel_id = EXCLUDED.channel_id,
                    gamemode_id = EXCLUDED.gamemode_id,
                    message_id = EXCLUDED.message_id,
                    slots = EXCLUDED.slots,
                    description = EXCLUDED.description
                RETURNING *;`,
            [
                post.guild_id,
                post.game_id,
                post.channel_id,
                post.gamemode_id,
                post.message_id,
                post.owner_id,
                post.slots,
                post.description
            ]
        );
        // attach roles
        if (attachedRoleIds.length > 0) {
            await database.query(
                `INSERT INTO lfg_post_roles (post_id, role_id)
                SELECT $1, UNNEST($2::int[])
                ON CONFLICT DO NOTHING;`,
                [postResult[0]!.id, attachedRoleIds]
            )
        }

        this.systemCache.postCache.set(String(postResult[0]!.id), postResult[0]!);
        return postResult[0]!;
    }

    /**
     * @param durationSeconds The lifetime of a lfg post message collector in seconds 
     */
    async getExpiredPosts(durationSeconds: number): Promise<LfgPostTable[]> {
        const expiresAt = timestampNow() - durationSeconds;
        const cache = this.systemCache.postCache.getByValue(
            (value) => value.created_at <= expiresAt
        );
        if (cache && cache.length > 0) return cache;
        const { rows: data } = await database.query<LfgPostTable>(
            `SELECT *
            FROM lfg_posts
            WHERE created_at <= $1`,
            [expiresAt]
        );

        for (const row of data) {
            this.systemCache.postCache.set(String(row.id), row);
        }

        return data;
    }

    /**
     * Delete posts older than @param durationSeconds seconds.
     */
    async deleteExpiredPosts(durationSeconds: number): Promise<void> {
        const expiresAt = timestampNow() - durationSeconds;
        await database.query(`DELETE FROM lfg_posts WHERE created_at <= $1`, [expiresAt]);
        this.systemCache.postCache.deleteByValue(
            (value) => value.created_at <= expiresAt
        );
    }

    async deletePostById(id: number) {
        await database.query(`DELETE FROM lfg_posts WHERE id=$1`, [id]);
        this.systemCache.postCache.delete(String(id));
    }

    async deletePostBySnowflake(messageId: Snowflake) {
        await database.query(`DELETE FROM lfg_posts WHERE message_id=$1`, [messageId]);
        this.systemCache.postCache.deleteByValue((value) => value.message_id === messageId);
    }

    async postGameCounter(gameId: number): Promise<number> {
        const { rows: [{ count }] } = await database.query(`SELECT COUNT(*) as count FROM lfg_posts WHERE game_id=$1`, [gameId]);

        return Number(count);
    }
    /**
     * 
     * @param postId The post to be updated
     * @param messageId The new message snowflake to be associated with the post
     * @returns The updated post row
     */
    async bumpPostMessageId(postId: number, messageId: Snowflake): Promise<LfgPostTable> {
        const { rows: result } = await database.query(
            `UPDATE lfg_posts SET message_id=$2, created_at=$3 WHERE id=$1
            RETURNING *;`,
            [postId, messageId, timestampNow()]
        );
        this.systemCache.postCache.set(String(result[0]!.id), result[0]!);
        return result[0]!;
    }

    /**
     * Fetch a post by owner id inside a specific guild-game combination
     */
    async getPostByOwnerId(guildId: Snowflake, gameId: number, ownerId: string): Promise<LfgPostTable | null> {
        const cache = this.systemCache.postCache.getByValue(
            (value) => value.guild_id === guildId && value.game_id === gameId && value.owner_id === ownerId
        );
        if (cache && cache[0]) return cache[0];
        const { rows: data } = await database.query<LfgPostTable>(
            `SELECT * FROM lfg_posts WHERE guild_id=$1 AND game_id=$2 AND owner_id=$3`,
            [guildId, gameId, ownerId]
        );

        if (data && data[0]) {
            this.systemCache.postCache.set(String(data[0].id), data[0]);
            return data[0];
        } else {
            return null;
        }
    }

    async getAllPosts(): Promise<LfgPostTable[]> {
        const { rows: data } = await database.query<LfgPostTable>(
            `SELECT * FROM lfg_posts;`
        );

        // populate cache
        for (const row of data) {
            this.systemCache.postCache.set(String(row.id), row);
        }
        return data;
    }

    /**
     * 
     * @returns All posts with their discord channel snowflake attached
     */
    async getAllPostsWithChannel(): Promise<LfgPostWithChannelTable[]> {

        const { rows: data } = await database.query<LfgPostWithChannelTable>(
            `SELECT
                p.*,
                c.discord_channel_id
            FROM lfg_posts p
            JOIN lfg_channels c
                ON c.id = p.channel_id
            ORDER BY p.created_at DESC;`
        );

        return data;
    }

    /**
     * Get lfg posts joined with their channel snowflake that are older (created_at < current timestamp - duration) than 
     * the given duration in seconds.
     */
    async getAllExpiredPostsWithChannel(durationSeconds: number): Promise<LfgPostWithChannelTable[]> {
        const { rows: data } = await database.query<LfgPostWithChannelTable>(
            `SELECT
                p.*,
                c.discord_channel_id
            FROM lfg_posts p
            JOIN lfg_channels c
                ON c.id = p.channel_id
            WHERE p.created_at <= $1`,
            [timestampNow() - durationSeconds]
        );

        return data;
    }
    //////////////////////////////////////
    // inter-table related repositories
    //////////////////////////////////////
    /**
     * Provide the (database, not Snowflake) id for the channel and the gamemode to be attached
     */
    async attachGamemodeToChannel(lfgChannelId: number, lfgGamemodeId: number) {
        await database.query(
            `INSERT INTO lfg_channel_gamemodes (channel_id, gamemode_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING;`,
            [lfgChannelId, lfgGamemodeId]
        );
    }

    async deattachGamemodesAndChannels(channelIds: number[], gamemodeIds: number[]) {
        await database.query(
            `DELETE FROM lfg_channel_gamemodes WHERE channel_id=ANY($1::int[]) AND gamemode_id=ANY($2::int[])`,
            [channelIds, gamemodeIds]
        )
    };

    async attachGamemodesToChannelsArray(channelIds: number[], gamemodeIds: number[]) {
        await database.query(
            `INSERT INTO lfg_channel_gamemodes (channel_id, gamemode_id)
            SELECT c, g
            FROM UNNEST($1::int[]) AS c
            CROSS JOIN UNNEST($2::int[]) AS g
            ON CONFLICT DO NOTHING;`,
            [channelIds, gamemodeIds]
        );
    }

    /**
     * @returns All gamemodes attached to the given channel 
     */
    async getChannelGamemodesBySnowflake(channelId: Snowflake): Promise<LfgGamemodeTable[]> {
        const { rows: data } = await database.query<LfgGamemodeTable>(
            `SELECT gm.*
            FROM lfg_channels ch
            JOIN lfg_channel_gamemodes cgm
                ON cgm.channel_id = ch.id
            JOIN lfg_gamemodes gm
                ON gm.id = cgm.gamemode_id
            WHERE ch.discord_channel_id=$1
            ORDER BY gm.name;`,
            [channelId]
        );

        return data;
    }

    /**
     * Fetch the post of a member in the guild-game pair
     * @returns The post row and the discord channel snowflake of the post
     */
    async getPostWithChannelByOwner(
        guildId: string,
        gameId: number,
        ownerId: string
    ): Promise<LfgPostWithChannelTable | null> {
        const postCache = this.systemCache.postCache.getByValue(
            (value) =>
                value.guild_id === guildId
                && value.game_id === gameId
                && value.owner_id === ownerId
        );

        if (postCache && postCache[0]) {
            const channelCache = this.systemCache.channelCache.get(String(postCache[0].channel_id));
            if (!channelCache) return null;
            return {
                ...postCache[0],
                discord_channel_id: channelCache.discord_channel_id!
            }
        }
        const { rows: data } = await database.query<LfgPostWithChannelTable>(
            `SELECT p.*, c.discord_channel_id
            FROM lfg_posts p
            JOIN lfg_channels c
                ON c.id = p.channel_id
            WHERE p.guild_id=$1
                AND p.game_id=$2
                AND p.owner_id=$3
            LIMIT 1;`,
            [guildId, gameId, ownerId]
        );

        if (data && data[0]) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { discord_channel_id, ...post } = data[0];
            this.systemCache.postCache.set(String(post.id), post)
            return data[0];
        } else {
            return null;
        }
    }

    /**
     * Fetch all the posts of a member in a guild, no matter the game
     */
    async getAllMemberPosts(guildId: string, ownerId: string): Promise<LfgPostWithChannelTable[]> {
        const cacheResult: LfgPostWithChannelTable[] = [];
        const postCache = this.systemCache.postCache.getByValue(
            (value) => value.guild_id === guildId && value.owner_id === ownerId
        );
        if (postCache) {
            for (const post of postCache) {
                const channelCache = this.systemCache.channelCache.get(String(post.channel_id));
                if (!channelCache) continue;
                cacheResult.push({
                    ...post,
                    discord_channel_id: channelCache.discord_channel_id!
                });
            }

            if (cacheResult.length > 0) return cacheResult;
        }
        const { rows: data } = await database.query<LfgPostWithChannelTable>(
            `SELECT p.*, c.discord_channel_id
            FROM lfg_posts p
            JOIN lfg_channels c
                ON c.id = p.channel_id
            WHERE p.guild_id=$1
                AND p.owner_id=$2`,
            [guildId, ownerId]
        );

        for (const row of data) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { discord_channel_id, ...post } = row;
            this.systemCache.postCache.set(String(post.id), post);
        }

        return data;
    }

    /**
     * Fetch all posts for a guild-game pair
     * @returns All post rows with their discord channel snowflake
     */
    async getPostsWithChannelByGame(
        guildId: string,
        gameId: number
    ): Promise<LfgPostWithChannelTable[]> {
        const { rows: data } = await database.query<LfgPostWithChannelTable>(
            `SELECT
                p.*,
                c.discord_channel_id
            FROM lfg_posts p
            JOIN lfg_channels c
                ON c.id = p.channel_id
            WHERE p.guild_id = $1
            AND p.game_id = $2
            ORDER BY p.created_at DESC;`,
            [guildId, gameId]
        );

        return data;
    }

    async getPostsFullByGame(
        guildId: string,
        gameId: number
    ): Promise<LfgPostFullRow[]> {
        const { rows } = await database.query<LfgPostFullRow>(
            `SELECT
                p.*,
                c.discord_channel_id,
                gm.name AS gamemode_name,

                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', r.id,
                            'guild_id', r.guild_id::text,
                            'game_id', r.game_id,
                            'role_id', r.role_id::text,
                            'type', r.type
                        )
                    ) FILTER (WHERE r.id IS NOT NULL),
                    '[]'
                ) AS roles

            FROM lfg_posts p

            JOIN lfg_channels c
                ON c.id = p.channel_id

            LEFT JOIN lfg_gamemodes gm
                ON gm.id = p.gamemode_id

            LEFT JOIN lfg_post_roles pr
                ON pr.post_id = p.id

            LEFT JOIN lfg_roles r
                ON r.id = pr.role_id

            WHERE p.guild_id = $1
            AND p.game_id = $2

            GROUP BY
                p.id,
                c.discord_channel_id,
                gm.name

            ORDER BY p.created_at DESC;`,
            [guildId, gameId]
        );

        return rows;
    }


}

const LfgSystemRepo = new LfgSystemRepository();
export default LfgSystemRepo;