import database from "../Config/database.js";
import { AntiAltGuardSetupObj, AntiAltGuardSetupRow } from "../Interfaces/database_types.js";

class AntiAltGuardRepository {

    async getGuildSetup(guildId: string): Promise<AntiAltGuardSetupRow | null> {
        const { rows: data } = await database.query<AntiAltGuardSetupRow>(
            `SELECT * FROM antialtguard_setup WHERE guild=$1;`,
            [guildId]
        );

        return data[0] ?? null;
    }

    async upsertSetup(newRow: AntiAltGuardSetupObj): Promise<AntiAltGuardSetupRow> {
        const { rows: result } = await database.query<AntiAltGuardSetupRow>(
            `INSERT INTO antialtguard_setup (
                guild, 
                category, 
                verification_channel, 
                verification_message_menu, 
                assessment_channel, 
                verified_role
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (guild)
            DO UPDATE SET
                category = EXCLUDED.category,
                verification_channel = EXCLUDED.verification_channel,
                verification_message_menu = EXCLUDED.verification_message_menu,
                assessment_channel = EXCLUDED.assessment_channel,
                verified_role = EXCLUDED.verified_role

            RETURNING *;
            `,
            [
                newRow.guild,
                newRow.category,
                newRow.verification_channel,
                newRow.verification_message_menu,
                newRow.assessment_channel,
                newRow.verified_role
            ]
        );

        return result[0]!;
    }

    async deleteSetup(guildId: string) {
        await database.query(`DELETE FROM antialtguard_setup WHERE guild=$1`, [guildId]);
    }

    async onSystemComponentDelete(guildId: string, componentSnowflake: string) {
        await database.query(
            `DELETE FROM antialtguard_setup 
            WHERE
                guild=$1
                AND (
                    category=$2 
                    OR verification_channel=$2 
                    OR assessment_channel=$2 
                    OR verification_message_menu=$2
                    OR verified_role=$2
                )`,
            [guildId, componentSnowflake]
        );
    }
};

const AntiAltGuardRepo = new AntiAltGuardRepository();
export default AntiAltGuardRepo;