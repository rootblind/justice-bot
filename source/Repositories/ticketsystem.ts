import database from "../Config/database.js";
import { OpenTicketTable, TicketManager, TicketSubject } from "../Interfaces/database_types.js";

class TicketSystemRepository {
    //////////////////////////////////
    // ticketmanager
    //////////////////////////////////
    async deleteGuildManager(guildId: string) {
        await database.query(`DELETE FROM ticketmanager WHERE guild=$1`, [guildId]);
    }

    /**
     * Set the guild's ticket manager row.
     * 
     * On guild conflict: update category, channel and message
     */
    async setGuildManager(ticketManagerTable: TicketManager): Promise<TicketManager & { id: number }> {
        const { guild, category, channel, message } = ticketManagerTable
        const { rows: data } = await database.query<TicketManager & { id: number }>(
            `INSERT INTO ticketmanager (guild, category, channel, message)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ON CONSTRAINT ticket_manager_guild
            DO UPDATE SET
                category = EXCLUDED.category,
                channel = EXCLUDED.channel,
                message = EXCLUDED.message
            RETURNING *;`,
            [guild, category, channel, message]
        )

        return data[0]!;
    }

    async onManagerDelete(guildId: string, componentId: string) {
        await database.query(
            `DELETE FROM ticketmanager 
            WHERE guild=$1
                AND (category=$2 OR channel=$2 OR message=$2)`,
            [guildId, componentId]
        )
    }

    /**
     * Get the ticket system guild configuration.
     */
    async getManager(guildId: string): Promise<(TicketManager & { id: number }) | null> {
        const { rows: data } = await database.query<TicketManager & { id: number }>(
            `SELECT *
            FROM ticketmanager
            WHERE guild=$1`,
            [guildId]
        );

        if (data && data[0]) return data[0];
        return null;
    }

    async fetchAllManagers(): Promise<(TicketManager & { id: number })[]> {
        const { rows: data } = await database.query<TicketManager & { id: number }>(
            `SELECT * FROM ticketmanager;`
        )

        return data;
    }

    //////////////////////////////////
    // ticketsubject
    //////////////////////////////////

    /**
     * Get all the ticketsubject rows of the guild
     */
    async getGuildSubjects(guildId: string): Promise<(TicketSubject & { id: number })[]> {
        const { rows: data } = await database.query<TicketSubject & { id: number }>(
            `SELECT *
            FROM ticketsubject
            WHERE guild=$1`,
            [guildId]
        );

        return data;
    }

    async registerSubject(ticketSubject: TicketSubject): Promise<TicketSubject & { id: number }> {
        const { rows: data } = await database.query<TicketSubject & { id: number }>(
            `INSERT INTO ticketsubject (guild, subject, description)
            VALUES ($1, $2, $3)
            ON CONFLICT (guild, subject)
            DO UPDATE SET
                description = EXCLUDED.description
            RETURNING *;`,
            [ticketSubject.guild, ticketSubject.subject, ticketSubject.description]
        );

        return data[0]!;
    }

    async deleteSubject(guildId: string, subjectOrId: string | number) {
        await database.query(
            `DELETE FROM ticketsubject WHERE guild=$1 AND (subject=$2 OR id=$2)`,
            [guildId, subjectOrId]
        );
    }

    async deleteSubjectsBulk(guildId: string, ids: number[] | string[]) {
        await database.query(`DELETE FROM ticketsubject WHERE guild=$1 AND id=ANY($2::int[])`, [guildId, ids]);
    }

    //////////////////////////////////
    // openticket
    //////////////////////////////////

    async fetchAllTickets(): Promise<(OpenTicketTable & { id: number })[]> {
        const { rows: data } = await database.query<OpenTicketTable & { id: number }>(
            `SELECT * FROM openticket;`
        )

        return data;
    }

    async getMemberTicket(guildId: string, memberId: string): Promise<OpenTicketTable | null> {
        const { rows: data } = await database.query<OpenTicketTable>(
            `SELECT *
            FROM openticket
            WHERE guild=$1
                AND member=$2`,
            [guildId, memberId]
        );

        if (data && data[0]) return data[0];
        return null;
    }

    /**
     * Register an open ticket.
     * 
     * On guild-member conflict: the existing row gets updated.
     */
    async registerTicket(ticketTable: OpenTicketTable): Promise<OpenTicketTable & { id: number }> {
        const { rows: data } = await database.query<OpenTicketTable & { id: number }>(
            `INSERT INTO openticket (guild, channel, message, member, subject, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (guild, member)
            DO UPDATE SET
                channel = EXCLUDED.channel,
                message = EXCLUDED.message,
                subject = EXCLUDED.subject,
                timestamp = EXCLUDED.timestamp
            RETURNING *;`,
            [
                ticketTable.guild,
                ticketTable.channel,
                ticketTable.message,
                ticketTable.member,
                ticketTable.subject,
                ticketTable.timestamp
            ]
        )

        return data[0]!;
    }

    async deleteTicketBySnowflake(messageId: string) {
        await database.query(`DELETE FROM openticket WHERE message=$1`, [messageId]);
    }

    /**
     * Get the ticket row based on its message id.
     */
    async getTicketBySnowflake(messageId: string): Promise<OpenTicketTable & { id: number } | null> {
        const { rows: data } = await database.query<OpenTicketTable & { id: number }>(
            `SELECT *
            FROM openticket
            WHERE message=$1`,
            [messageId]
        );

        if (data && data[0]) return data[0];
        return null;
    }
}

const TicketSystemRepo = new TicketSystemRepository();
export default TicketSystemRepo;