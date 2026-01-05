import type { Snowflake } from "discord.js";
import { SelfCache } from "../Config/SelfCache.js";
import { AutoVoiceSystem } from "../Interfaces/database_types.js";
import database from "../Config/database.js"

const autoVoiceCache = new SelfCache<string, AutoVoiceSystem>(24 * 60 * 60_000);

class AutoVoiceSystemRepository {
    async getAll(): Promise<AutoVoiceSystem[]> {
        const {rows: data} = await database.query<AutoVoiceSystem>(
            `SELECT * FROM autovoicesystem`
        );

        for(const row of data) {
            // cache all rows
            autoVoiceCache.set(`${row.guild}:${row.message}`, row);
        }

        return data;
    }

    async isAutoVoice(guildId: Snowflake, channelId: Snowflake): Promise<boolean> {
        const cache = autoVoiceCache.getByValue((row) => row.autovoice === channelId);
        if(cache !== undefined) return cache.length > 0;

        const {rows: data} = await database.query(
            `SELECT EXISTS
                (SELECT 1 FROM autovoicesystem WHERE guild=$1 AND autovoice=$2)`,
            [guildId, channelId]
        );

        return data[0].exists as boolean;
    }
    /**
     * Fetches autovoice systems as array
     * @param guildId Guild Snowflake
     * @returns All autovoice systems on this guild
     */
    async getGuildSystems(guildId: Snowflake): Promise<AutoVoiceSystem[]> {
        const cache = autoVoiceCache.getByValue((_, key) => key.startsWith(guildId));
        if(cache !== undefined) return cache;

        const {rows: data} = await database.query<AutoVoiceSystem>(
            `SELECT * FROM autovoicesystem WHERE guild=$1`, [ guildId ]
        );

        // set cache
        if(data.length) {
            data.forEach((row) => {
                autoVoiceCache.set(`${guildId}:${row.message}`, row);
            });
        }

        return data;
    }

    /**
     * Fetch the autovoicesystem of the guild based on autovoice channel id
     */
    async getAutoVoiceSystem(guildId: Snowflake, autovoice: Snowflake): Promise<AutoVoiceSystem | null> {
        const cache = autoVoiceCache.getByValue((row) => row.autovoice === autovoice);
        if(cache !== undefined && cache[0]) return cache[0];

        const {rows: data} = await database.query<AutoVoiceSystem>(
            `SELECT * FROM autovoicesystem WHERE guild=$1 AND autovoice=$2`,
            [guildId, autovoice]
        );

        if(data.length && data[0]) {
            autoVoiceCache.set(`${guildId}:${data[0].message}`, {
                guild: guildId,
                category: data[0].category,
                autovoice: data[0].autovoice,
                managerchannel: data[0].managerchannel,
                message: data[0].message
            });

            return data[0];
        } else {
            return null;
        }
    }

    /**
     * Fetch the autovoicesystem of the guild based on interface id (the message that acts as the manager)
     */
    async getInterfaceSystem(guildId: Snowflake, messageId: Snowflake): Promise<AutoVoiceSystem | null> {
        const cache = autoVoiceCache.getByValue((row) => row.message === messageId);
        if(cache !== undefined && cache[0]) return cache[0];
        
        const {rows: data} = await database.query<AutoVoiceSystem>(
            `SELECT * FROM autovoicesystem WHERE guild=$1 AND message=$2`,
            [guildId, messageId]
        );

        if(data.length && data[0]) {
            autoVoiceCache.set(`${guildId}:${messageId}`, {
                guild: guildId,
                category: data[0].category,
                autovoice: data[0].autovoice,
                managerchannel: data[0].managerchannel,
                message: messageId
            });

            return data[0];
        } else {
            return null;
        }
    }
    /**
     * 
     * @param guildId Guild Snowflake
     * @returns The count of how many autovoice systems are on the guild
     */
    async guildSystemsCount(guildId: Snowflake): Promise<number> {
        const cache = autoVoiceCache.getByValue((_, key) => key.startsWith(guildId));
        if(cache !== undefined) return cache.length;

        const { rows: [{count}] } = await database.query(
            `SELECT COUNT(*) AS count FROM autovoicesystem WHERE guild=$1`, [ guildId ]
        );

        return Number(count);
    }

    /**
     * Insert or update the guild's autovoice system row
     * @param guildId Guild Snowflake
     * @param category Category Snowflake
     * @param managerchannel Text channel Snowflake
     * @param autovoice Voice Snowflake
     * @param message Message Snowflake
     */
    async put(
        guildId: Snowflake,
        category: Snowflake,
        managerchannel: Snowflake,
        autovoice: Snowflake,
        message: Snowflake
    ): Promise<void> {
        await database.query(
            `INSERT INTO autovoicesystem (guild, category, managerchannel, autovoice, message)
                VALUES($1, $2, $3, $4, $5)
                ON CONFLICT (guild, message) DO UPDATE SET
                    category = EXCLUDED.category,
                    managerchannel = EXCLUDED.managerchannel,
                    autovoice = EXCLUDED.autovoice,
                    message = EXCLUDED.message`,
            [guildId, category, managerchannel, autovoice, message]
        );

        const cache: AutoVoiceSystem = {
            guild: guildId,
            category: category,
            managerchannel: managerchannel,
            autovoice: autovoice,
            message: message
        };

        autoVoiceCache.set(`${guildId}:${message}`, cache);
    }

    async deleteSystem(guildId: Snowflake, message: Snowflake) {
        autoVoiceCache.delete(`${guildId}:${message}`);
        const result = await database.query(`DELETE FROM autovoicesystem WHERE guild=$1 AND message=$2`, [guildId, message]);
        return result.rowCount;
    }

    async onChannelDelete(guildId: Snowflake, channelId: Snowflake) {
        autoVoiceCache.deleteByValue((s) =>
            s.category === channelId || s.autovoice === channelId || s.managerchannel === channelId
        );

        await database.query(
            `DELETE FROM autovoicesystem
                WHERE guild = $1
                AND (category = $2 OR autovoice = $2 OR managerchannel = $2);`,
            [guildId, channelId]
        );
    }

    async wipeGuildSystems(guildId: Snowflake) {
        autoVoiceCache.deleteByValue((_, key) => key.startsWith(guildId));
        await database.query(
            `DELETE FROM autovoicesystem WHERE guild=$1`,
            [ guildId ]
        );
    }
}

const AutoVoiceSystemRepo = new AutoVoiceSystemRepository();
export default AutoVoiceSystemRepo;