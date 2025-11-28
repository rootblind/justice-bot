const {EmbedBuilder} = require("discord.js");
const {poolConnection} = require("./kayle-db.js");

async function strike_handler(member) {
    const {rows: [{countstrike}]} = await poolConnection.query(`SELECT COUNT(*) AS countstrike
        FROM staffstrike
        WHERE guild=$1 AND striked=$2 AND expires > $3`,
        [member.guild.id, member.id, Math.floor(Date.now() / 1000)]
    );

    const {rows: triggerRuleData} = await poolConnection.query(`SELECT punishment FROM strikerule
        WHERE guild=$1 AND strikecount=$2`,
        [member.guild.id, countstrike]
    )

    if(triggerRuleData.length == 0) return; // if there is no rule for this, do nothing

    const {rows: staffRolesData} = await poolConnection.query(`SELECT * FROM staffroles WHERE guild=$1`, [member.guild.id]);
    const {rows: staffRoleData} = await poolConnection.query(`SELECT role FROM serverroles WHERE guild=$1 AND roletype='staff'`,
        [member.guild.id]
    );

    let staffrole = null;
    try{
        staffrole = await member.guild.roles.fetch(staffRoleData[0].role);
    } catch(err) {
        console.error(err);
    }

    let logChannel = null;
    const {rows: logChannelData} = await poolConnection.query(`SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype='moderation'`,
        [member.guild.id]
    );

    try{
        logChannel = await member.guild.channels.fetch(logChannelData[0].channel); 
    } catch(err) {};

    // else, apply the punishment
    if(triggerRuleData[0].punishment == "kick") {
        await member.roles.remove(staffrole);

        if (staffRolesData.length) {
            const rolesToRemove = staffRolesData
                .map(row => row.role)
                .filter(roleId => member.roles.cache.has(roleId));

            if (rolesToRemove.length) {
                await member.roles.remove(rolesToRemove);
            }
        }

        if(logChannel) {
            await logChannel.send({
                embeds: [
                    new EmbedBuilder()
                        .setAuthor({
                            name: `${member.user.username} is no longer a staff member`,
                            iconURL: member.displayAvatarURL({format: "png"})
                        })
                        .setColor("Red")
                        .setDescription(`${member} triggered the rule at ${countstrike} strikes and was kicked out of the staff team.`)
                        .setTimestamp()
                        .setFooter({text: `ID: ${member.id}`})
                ]
            });
        }

        try{
            await member.send({
                embeds: [
                    new EmbedBuilder()
                        .setAuthor({
                            name: `You are no longer a staff member in ${member.guild.name}`,
                            iconURL: member.guild.iconURL({format: "png"})
                        })
                        .setColor("Red")
                        .setDescription(`You got ${countstrike} strikes which resulted into being kicked out of the staff.`)
                        .setTimestamp()
                ]
            });
        } catch(err) {};

        // removing the member from the strikes since they are no longer in staff
        await poolConnection.query(`DELETE FROM staffstrike WHERE guild=$1 AND striked=$2`,
            [member.guild.id, member.id]
        );

    } else {
        // if the member has the lowest staff role, will get kicked instead of being downgraded
        const {rows: staffRoleDowngradeData} = await poolConnection.query(`SELECT * FROM staffroles
            WHERE guild=$1
                AND (position = (SELECT MIN(position) FROM staffroles WHERE guild=$1)
                    OR position <= $2)
            ORDER BY position DESC
            LIMIT 2`,
            [member.guild.id, member.roles.highest.position]
        );
        if(staffRoleDowngradeData.length == 1) {
            // one result means the member needs to be kicked out of staff
            await member.roles.remove(staffrole);
            await member.roles.remove(staffRoleDowngradeData[0].role);

            if(logChannel) {
                await logChannel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setAuthor({
                                name: `${member.user.username} is no longer a staff member`,
                                iconURL: member.displayAvatarURL({format: "png"})
                            })
                            .setColor("Red")
                            .setDescription(`${member} triggered the rule at ${countstrike} strikes and was kicked out of the staff team.`)
                            .setTimestamp()
                            .setFooter({text: `ID: ${member.id}`})
                    ]
                });
            }

            try{
                await member.send({
                    embeds: [
                        new EmbedBuilder()
                            .setAuthor({
                                name: `You are no longer a staff member in ${member.guild.name}`,
                                iconURL: member.guild.iconURL({format: "png"})
                            })
                            .setColor("Red")
                            .setDescription(`You got ${countstrike} strikes which resulted into being kicked out of the staff.`)
                            .setTimestamp()
                    ]
                });
            } catch(err) {};

            await poolConnection.query(`DELETE FROM staffstrike WHERE guild=$1 AND striked=$2`,
                [member.guild.id, member.id]
            );
        } else if(staffRoleDowngradeData.length == 2) {
            await member.roles.remove(staffRoleDowngradeData[0].role);
            const downRole = await member.guild.roles.fetch(staffRoleDowngradeData[1].role);
            await member.roles.add(downRole);

            if(logChannel) {
                await logChannel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setAuthor({
                                name: `${member.user.username} got downgraded`,
                                iconURL: member.displayAvatarURL({format: "png"})
                            })
                            .setColor("Red")
                            .setDescription(`${member} triggered the rule at ${countstrike} strikes and was downgraded to **${downRole.name}**.`)
                            .setTimestamp()
                            .setFooter({text: `ID: ${member.id}`})
                    ]
                });
            }
        }
    }
}

module.exports = {
    strike_handler
}