import database from "../Config/database.js";
import { DailyMessageObject } from "../Interfaces/database_types.js";

class DailyMessageRepository {
    async insert(newMessage: DailyMessageObject): Promise<DailyMessageObject & { id: number }> {
        const result = await database.query<DailyMessageObject & { id: number }>(
            `INSERT INTO dailymessage(guild, channel, messageid, message, schedule)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;`,
            [newMessage.guild, newMessage.channel, newMessage.messageid, newMessage.message, newMessage.schedule]
        );

        return result.rows[0]!;
    }

    async delete(guildId: string, messageId: string) {
        await database.query(`DELETE FROM dailymessage WHERE guild=$1 AND messageid=$2`, [guildId, messageId]);
    }

    async update(guildId: string, messageId: string, newMessageId: string): Promise<DailyMessageObject & { id: number }> {
        const result = await database.query<DailyMessageObject & { id: number }>(
            `UPDATE dailymessage SET messageid=$3 WHERE guild=$1 AND messageid=$2
            RETURNING *;`,
            [guildId, messageId, newMessageId]
        );

        return result.rows[0]!;
    }

    async getDailyMessage(guildId: string, messageId: string): Promise<(DailyMessageObject & { id: number }) | null> {
        const { rows: data } = await database.query<DailyMessageObject & { id: number }>(
            `SELECT * FROM dailymessage WHERE guild=$1 AND messageid=$2`,
            [guildId, messageId]
        );

        if (data && data[0]) {
            return data[0];
        } else {
            return null;
        }
    }

    async getTable(): Promise<(DailyMessageObject & { id: number })[]> {
        const { rows: data } = await database.query<DailyMessageObject & { id: number }>(
            `SELECT * FROM dailymessage;`
        );

        return data;
    }
};

const DailyMessageRepo = new DailyMessageRepository();
export default DailyMessageRepo;