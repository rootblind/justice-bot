/*
    Members can look each other's infractions
*/

const {EmbedBuilder, SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType} = require('discord.js');
const {poolConnection} = require('../../utility_modules/kayle-db');

// using the object for easier reference in code
const punishType = {
    0: "Warn",
    1: "Timeout",
    2: "Tempban",
    3: "Indefinite Ban",
    4: "Permaban"
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infractions')
        .setDescription('Look up someone\'s infractions.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to look up infractions for.')

        ),

    async execute(interaction, client) {
        const user = interaction.options.getUser('member') || interaction.user.id;
        let member = null;
        
        try{
            member = await interaction.guild.members.fetch(user);
        } catch(err) {};

        await interaction.deferReply();

        // fetching the member data from punishlogs
        const {rows : memberData} = await poolConnection.query(`SELECT * FROM punishlogs WHERE guild=$1 AND target=$2
            ORDER BY timestamp DESC LIMIT 5`,
            [interaction.guild.id, user.id]
        );

        const {rows: [{count}]} = await poolConnection.query(`SELECT COUNT(*) AS count
            FROM punishlogs
            WHERE guild=$1
                AND target=$2`,
            [interaction.guild.id, user.id]
        )

        

        if(count == 0) {
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('Aqua')
                        .setAuthor({name: `${user.username}'s infractions`, iconURL: user.displayAvatarURL({extension: 'png'})})
                        .setDescription('No infractions registered.')
                ]
            })
        }

        const {rows: [{count_lastmonth}]} = await poolConnection.query(`SELECT COUNT(*) AS count_lastmonth
            FROM punishlogs
            WHERE guild=$1
                AND target=$2
                AND timestamp >= $3`, [interaction.guild.id, user.id, parseInt(Date.now() / 1000) - 2_592_000])

        
        let overviewString = ""
        memberData.forEach((row) => {
            overviewString += `**${punishType[row.punishment_type]}**: ${row.reason == "no_reason" ? "No reason" : row.reason}  -  <t:${row.timestamp}:R>\n`
        });

        if(!overviewString)
            overviewString = "No results!"

        const embedOverview = new EmbedBuilder()
            .setColor('Aqua')
            .setAuthor({name: `${user.username}'s infractions overview`, iconURL: user.displayAvatarURL({extension: 'png'})})
            .addFields(
                {
                    name: 'Total',
                    value: `${count} infractions`,
                    inline: true
                },
                {
                    name: 'Last month',
                    value: `${count_lastmonth} infractions`,
                    inline: true
                },
                {
                    name: "Last 5 infractions",
                    value: `${overviewString}`
                }
            )

        const {rows: memberWarns} = await poolConnection.query(`SELECT * FROM punishlogs
            WHERE guild=$1
                AND target=$2
                AND punishment_type=0
            ORDER BY timestamp DESC
            LIMIT 20`,
            [interaction.guild.id, user.id]
        
        );

        const {rows: [{count_totalwarn}]} = await poolConnection.query(`SELECT COUNT(*) AS count_totalwarn
            FROM punishlogs
            WHERE guild=$1
                AND target=$2`, [interaction.guild.id, user.id]);

        const {rows: [{countwarn_month}]} = await poolConnection.query(`SELECT COUNT(*) AS countwarn_month
            FROM punishlogs
            WHERE guild=$1
                AND target=$2
                AND punishment_type=0
                AND timestamp >= $3`, [interaction.guild.id, user.id, parseInt(Date.now() / 1000) - 2_592_000]);

        let warnString = "";
        memberWarns.forEach((row) => {
            warnString += `**${row.reason}** - <t:${row.timestamp}:R>\n`
        });

        if(!warnString)
            warnString = "No results!"

        const embedWarns = new EmbedBuilder()
            .setColor('Aqua')
            .setAuthor({name: `${user.username}'s warns`, iconURL: user.displayAvatarURL({extension: 'png'})})
            .addFields(
                {
                    name: 'Total',
                    value: `${count_totalwarn} warns`,
                    inline: true
                },
                {
                    name: 'Last month',
                    value: `${countwarn_month} warns`,
                    inline: true
                },
                {
                    name: 'Last 20 warns',
                    value: `${warnString}`
                }
            )
        
        
        const {rows: memberTimes} = await poolConnection.query(`SELECT * FROM punishlogs
            WHERE guild=$1
                AND target=$2
                AND punishment_type=1
                ORDER BY timestamp DESC LIMIT 20`, [interaction.guild.id, user.id]);

        const {rows: [{count_totaltimes}]} = await poolConnection.query(`SELECT COUNT(*) AS count_totaltimes
            FROM punishlogs
            WHERE guild=$1
                AND target=$2
                AND punishment_type=1`, [interaction.guild.id, user.id]);

        const {rows: [{count_monthtimes}]} = await poolConnection.query(`SELECT COUNT(*) AS count_monthtimes
            FROM punishlogs
            WHERE guild=$1
                AND target=$2
                AND punishment_type=1
                AND timestamp >= $3`, [interaction.guild.id, user.id, parseInt(Date.now() / 1000) - 2_592_000]);

        
        let timeoutString = ""
        memberTimes.forEach((row) => {
            timeoutString += `**${row.reason == "no_reason" ? "No reason" : row.reason}** - <t:${row.timestamp}:R>\n`
        });
        if(!timeoutString)
            timeoutString = "No results!";

        const embedTimes = new EmbedBuilder()
            .setColor('Aqua')
            .setAuthor({name: `${user.username}'s times out`, iconURL: user.displayAvatarURL({extension: 'png'})})
            .addFields(
                {
                    name: 'Total',
                    value: `${count_totaltimes} times out`,
                    inline: true
                },
                {
                    name: 'Last month',
                    value: `${count_monthtimes} times out`,
                    inline: true
                },
                {
                    name: 'Last 20 times out',
                    value: `${timeoutString}`
                }
            )
        
        const {rows: memberBans} = await poolConnection.query(`SELECT * FROM punishlogs
            WHERE guild=$1 
                AND target=$2
                AND punishment_type>=2
                ORDER BY timestamp DESC LIMIT 20`, [interaction.guild.id, user.id]);

        const {rows: [{countbans}]} = await poolConnection.query(`SELECT COUNT(*) AS countbans FROM punishlogs
            WHERE guild=$1
                AND target=$2
                AND punishment_type>=2`, [interaction.guild.id, user.id]);

        let bansString = "";
        memberBans.forEach((row) => {
            bansString += `**${punishType[row.punishment_type]}**: ${row.reason} - <t:${row.timestamp}:R>\n`
        });

        if(!bansString)
            bansString = "No results!";
        const embedBans = new EmbedBuilder()
            .setColor('Aqua')
            .setAuthor({name: `${user.username}'s bans`, iconURL: user.displayAvatarURL({extension: 'png'})})
            .addFields(
                {
                    name: "Total bans",
                    value: `${countbans}`
                },
                {
                    name: 'Last 20 bans',
                    value: `${bansString}`
                }
            )

        const selectOptions = [
            {
                label: "Overview",
                value: "overview",
                description: "Overview of infractions"
            },
            {
                label: "Warns",
                value: "warns",
                description: "The warns of the member"
            },
            {
                label: "Times out",
                value: "timeout",
                description: "The times out of the member"
            },
            {
                label: "Bans",
                value: "bans",
                description: "The bans of the member"
            }
        ]

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select-infraction')
            .setPlaceholder('Choose the infractions list')
            .setMaxValues(1)
            .addOptions(selectOptions)

        const selectMenuActionRow = new ActionRowBuilder().addComponents( selectMenu );

        const selectMessage = await interaction.editReply({embeds: [embedOverview], components: [selectMenuActionRow]});

        const collector = await selectMessage.createMessageComponentCollector({
            ComponentType: ComponentType.StringSelect,
            filter: (i) => i.user.id === interaction.user.id
        });

        collector.on('collect', async(selectInteraction) => { 
            switch(selectInteraction.values[0]) {
                case "overview":
                    await selectMessage.edit({embeds: [embedOverview]});
                break;
                case "warns":
                    await selectMessage.edit({embeds: [embedWarns]});
                break;
                case "timeout":
                    await selectMessage.edit({embeds: [embedTimes]});
                break;
                case "bans":
                    await selectMessage.edit({embeds: [embedBans]});
                break;
            }

            await selectInteraction.reply({ephemeral: true, content: "Menu list updated."});
        })
    }
}