import { Snowflake } from "discord.js";
import { SelfCache } from "../Config/SelfCache.js";
import database from "../Config/database.js";
import { AutoVoiceRoom } from "../Interfaces/database_types.js";

const roomsCache = new SelfCache<string, AutoVoiceRoom>();
// keeps the expiration timestamp in seconds of a member in a guild
const cooldowns = new SelfCache<string, string>();
export const AUTOVOICE_COOLDOWN = 60;

class AutoVoiceRoomRepository {
    /**
     * Get timestamp in seconds of cooldown expiration or null if there is no cooldown.
     */
    async getCooldown(guildId: Snowflake, memberId: Snowflake): Promise<string | null> {
        const key = `${guildId}:${memberId}`;
        const cd = cooldowns.get(key);
        if (cd !== undefined) return cd;

        return null;
    }

    /**
     * Set cooldown to a member
     * 
     * @param cd Cooldown in seconds (defaults to 300seconds / 5mins)
     */
    async setCooldown(guildId: Snowflake, memberId: Snowflake, cd: number = AUTOVOICE_COOLDOWN) {
        const key = `${guildId}:${memberId}`;
        cooldowns.set(key, String(Math.floor((Date.now() / 1000) + cd)));
        setTimeout(() => cooldowns.delete(key), cd * 1000)
    }

    /**
     * Remove cooldown from member
     */
    async deleteCooldown(guildId: Snowflake, memberId: Snowflake) {
        const key = `${guildId}:${memberId}`;
        cooldowns.delete(key);
    }

    /**
     * @returns The entire table
     */
    async getRooms() {
        const { rows: data } = await database.query<AutoVoiceRoom>(
            `SELECT * FROM autovoiceroom`
        );
        for (const row of data) {
            roomsCache.set(`${row.guild}:${row.owner}`, row);
        }
        return data;
    }

    /**
     * Check if a member already owns a room in the specified guild 
     */
    async isOwner(guildId: Snowflake, memberId: Snowflake) {
        const cache = roomsCache.getByValue((_, key) => key.includes(memberId));
        if (cache !== undefined) return cache.length > 0;

        const { rows: data } = await database.query(
            `SELECT EXISTS
                (SELECT 1 FROM autovoiceroom WHERE guild=$1 AND owner=$2)`,
            [guildId, memberId]
        );

        return data[0].exists as boolean;
    }

    /**
     * Fetch the autovoiceroom of a member by member id
     */
    async getMemberRoom(guildId: Snowflake, memberId: Snowflake): Promise<AutoVoiceRoom | null> {
        const key = `${guildId}:${memberId}`;
        const cache = roomsCache.get(key);
        if (cache !== undefined) return cache;

        const { rows: data } = await database.query<AutoVoiceRoom>(
            `SELECT * FROM autovoiceroom WHERE guild=$1 AND owner=$2`,
            [guildId, memberId]
        );

        if (data.length && data[0]) {
            const room: AutoVoiceRoom = {
                guild: guildId,
                owner: memberId,
                timestamp: data[0].timestamp,
                order_room: data[0].order_room,
                channel: data[0].channel
            }
            roomsCache.set(key, room);

            return data[0];
        } else {
            return null;
        }
    }

    /**
     * Get room data by channel id
     */
    async getRoom(guildId: Snowflake, channelId: Snowflake): Promise<AutoVoiceRoom | null> {
        const cache = roomsCache.getByValue((room) => room.channel === channelId);
        if (cache !== undefined && cache[0]) return cache[0];

        const { rows: data } = await database.query<AutoVoiceRoom>(
            `SELECT * FROM autovoiceroom WHERE guild=$1 AND channel=$2`,
            [guildId, channelId]
        );

        if (data.length && data[0]) {
            roomsCache.set(`${guildId}:${data[0].owner}`, data[0]);
            return data[0];
        } else {
            return null;
        }
    }

    /**
     * Change the owner to a room by channel id
     */
    async changeOwnerRoom(guildId: Snowflake, newOwner: Snowflake, channelId: Snowflake): Promise<void> {
        const cache = roomsCache.getByValue((room) => room.channel === channelId);
        if (cache !== undefined && cache[0]) {
            roomsCache.delete(`${guildId}:${cache[0].owner}`);
            cache[0].owner = newOwner;
            roomsCache.set(`${guildId}:${newOwner}`, cache[0]);
        }

        await database.query(
            `UPDATE autovoiceroom SET owner=$3 WHERE guild=$1 AND channel=$2`,
            [guildId, channelId, newOwner]
        );
    }

    /**
     * Insert or update a row
     */
    async put(guildId: Snowflake, channel: Snowflake, owner: Snowflake, order_room: number) {
        const newRoom: AutoVoiceRoom = {
            guild: guildId,
            channel: channel,
            owner: owner,
            timestamp: String(Math.floor(Date.now() / 1000)),
            order_room: order_room
        }

        const key = `${guildId}:${owner}`;
        roomsCache.set(key, newRoom);

        await database.query(
            `INSERT INTO autovoiceroom(guild, channel, owner, timestamp, order_room)
                VALUES($1, $2, $3, $4, $5)
                ON CONFLICT (guild, owner)
                DO UPDATE SET
                    channel = EXCLUDED.channel,
                    timestamp = EXCLUDED.timestamp,
                    order_room = EXCLUDED.order_room`,
            [guildId, channel, owner, newRoom.timestamp, order_room]
        );
    }

    /**
     * Whether a channel is autovoice 
     */
    async isAutoVoiceRoom(guildId: Snowflake, channelId: Snowflake): Promise<boolean> {
        const cache = roomsCache.getByValue((room) => room.channel === channelId);
        if (cache !== undefined) return cache.length > 0;

        const { rows: data } = await database.query(
            `SELECT EXISTS
                (SELECT 1 FROM autovoiceroom WHERE guild=$1 AND channel=$2)`,
            [guildId, channelId]
        );

        return data[0].exists as boolean;
    }

    /**
     * Return whether the member is the owner of the channel
     */
    async isRoomOwner(guildId: Snowflake, memberId: Snowflake, channelId: Snowflake): Promise<boolean> {
        const cache = roomsCache.get(`${guildId}:${memberId}`);
        if (cache !== undefined) return cache.channel === channelId;

        const { rows: data } = await database.query(
            `SELECT EXISTS
                (SELECT 1 FROM autovoiceroom WHERE guild=$1 AND owner=$2 AND channel=$3)`,
            [guildId, memberId, channelId]
        );

        return data[0].exists as boolean;
    }

    /**
     * Delete room based on its ID
     */
    async deleteRoom(guildId: Snowflake, channelId: Snowflake) {
        roomsCache.deleteByValue((room) => room.channel === channelId);
        await database.query(`DELETE FROM autovoiceroom WHERE guild=$1 AND channel=$2`, [guildId, channelId]);
    }

    /**
     * Delete room based on its owner ID
     */
    async deleteOwnerRoom(guildId: Snowflake, memberId: Snowflake) {
        roomsCache.deleteByValue((room) => room.owner === memberId);
        await database.query(`DELETE FROM autovoiceroom WHERE guild=$1 AND owner=$2`, [guildId, memberId]);
    }

    async getLastOrder(guildId: Snowflake): Promise<number> {
        const { rows: data } = await database.query(
            `SELECT order_room FROM autovoiceroom WHERE guild=$1 ORDER BY order_room DESC LIMIT 1`,
            [guildId]
        );

        if (data.length && data[0]) return data[0].order_room as number;
        return 0;
    }
}

const AutoVoiceRoomRepo = new AutoVoiceRoomRepository()
export default AutoVoiceRoomRepo;