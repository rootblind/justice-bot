import database from "../Config/database.js";

class StaffStrikeRepository {
    async deleteExpiredEntries() {
        await database.query(`DELETE FROM staffstrike WHERE expires <= $1`,
            [Math.floor(Date.now() / 1000)]
        );
    }
}

const StaffStrikeRepo = new StaffStrikeRepository();
export default StaffStrikeRepo;