const {poolConnection} = require('../../utility_modules/kayle-db.js');
const {SlashCommandBuilder, Client, PermissionFlagsBits, EmbedBuilder} = require('discord.js');
const fs = require('fs');

// Setting up the database

// This command is to be run before using any of the bot commands that require a database connection.

module.exports = {
    cooldown: 3,
    ownerOnly: true,
    data: new SlashCommandBuilder()
        .setName('default-database')
        .setDescription('Set the default tables in the database.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    botPermissions: [PermissionFlagsBits.SendMessages],
    async execute(interaction, client){
        const embed = new EmbedBuilder()
            .setTitle('Default database tables');
        
        let table_nameListed = new Array(); // list of tables created through this command
        // will be used to compare to the expected tables from ./objects/database-default-tables.json

        // the following lines will be about opening and reading the JSON file mentioned above

        // upon object modifications, the bot will need to be restarted
        const dbTablesObject = JSON.parse(fs.readFileSync('./objects/database-default-tables.json'));
        let expectedTableNames = dbTablesObject["table_names"];
        
        let arrayOfTables = new Array(); 
        const existingTables = new Promise((resolve, reject) => {
            poolConnection.query(`SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema='public' 
                AND table_type = 'BASE TABLE'`,
                (err, result) => {
                    if(err){
                        console.error(err);
                        interaction.reply({embeds: [embed.setDescription('Database fault, check the console for reference!')
                            .setColor('Red')], ephemeral: true});
                        reject(err);
                    }
                    else {
                        
                        arrayOfTables.push(result.rows.map(row => row.table_name));
                        resolve(result);
                    }
                    
                });
        });
        await existingTables;
        arrayOfTables = JSON.stringify(arrayOfTables.slice().sort());

        // checking if tables already exist

        if(expectedTableNames.every(table => arrayOfTables.includes(table))){
            embed.setTitle('All tables already exist!')
                .setDescription('No table needs to be created!')
                .setColor('Red');
            return interaction.reply({embeds: [embed], ephemeral: true});
        }

        // Taking care of awaiting the query to execute through a promise
        const welcomescheme = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS welcomescheme (
                id bigint PRIMARY KEY,
                guild VARCHAR(32),
                active BOOLEAN DEFAULT false NOT NULL,
                channel VARCHAR(30),
                message VARCHAR(255),
                author BOOLEAN,
                title VARCHAR(255),
                colorcode VARCHAR(10),
                imagelink VARCHAR(255)
            )`, (err, result) => {
                if(err){
                    console.error(err);
                    interaction.reply({embeds: [embed.setDescription('Database fault, check the console for reference!')
                            .setColor('Red')], ephemeral: true});
                    reject(err);
                }
                else {

                    table_nameListed.push('welcomescheme');
                    resolve(result);
                }
            });
        });
        await welcomescheme;

        // used for knowing what panel has what roles
        const panelscheme = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS panelscheme (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                panelname VARCHAR(32) NOT NULL,
                roleid BIGINT NOT NULL,
                description VARCHAR(255)

            )`, (err, result) => {
                if(err){
                    console.error(err);
                    interaction.reply({embeds: [embed.setDescription('Database fault, check the console for reference!')
                            .setColor('Red')], ephemeral: true});
                    reject(err);
                }
                else {

                    table_nameListed.push('panelscheme');
                    resolve(result);
                }
            });
        });
        await panelscheme;

        // the headers of the panels. in this table, the panelname is unique and validations on panel
        // name can be done
        const panelheaders = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS panelheaders (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                panelname VARCHAR(32) NOT NULL
            )`, (err, result) => {
                if(err){
                    console.error(err);
                    interaction.reply({embeds: [embed.setDescription('Database fault, check the console for reference!')
                            .setColor('Red')], ephemeral: true});
                    reject(err);
                }
                else {

                    table_nameListed.push('panelheaders');
                    resolve(result);
                }
            });
        });
        await panelheaders;

        // this table stores data about panels sent as select menu messages
        // the use of this data is to delete the sent panels upon panel deletion
        const panelmessages = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS panelmessages (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                channel BIGINT NOT NULL,
                messageid BIGINT NOT NULL,
                panelname VARCHAR(32) NOT NULL

            )`, (err, result) => {
                if(err){
                    console.error(err);
                    interaction.reply({embeds: [embed.setDescription('Database fault, check the console for reference!')
                            .setColor('Red')], ephemeral: true});
                    reject(err);
                }
                else {

                    table_nameListed.push('panelmessages');
                    resolve(result);
                }
            });
        });
        await panelmessages;

        // the table where all reaction roles are stored
        const reactionroles = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS reactionroles (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                channel BIGINT NOT NULL,
                messageid BIGINT,
                roleid BIGINT,
                emoji TEXT
            )`, (err, result) => {
                if(err){
                    console.error(err);
                    interaction.reply({embeds: [embed.setDescription('Database fault, check the console for reference!')
                            .setColor('Red')], ephemeral: true});
                    reject(err);
                }
                else {

                    table_nameListed.push('reactionroles');
                    resolve(result);
                }
            });
        });
        await reactionroles;

        const serverroles = new Promise((resolve, reject) => {
            poolConnection.query(`
                CREATE TABLE IF NOT EXISTS serverroles (
                    id SERIAL PRIMARY KEY,
                    guild BIGINT NOT NULL,
                    roletype TEXT NOT NULL,
                    role BIGINT NOT NULL
                )
            `, (err, result) => {
                if(err) {
                    console.error(err);
                    interaction.reply({embeds: [embed.setDescription('Database fault, check the console for reference!')
                        .setColor('Red')], ephemeral: true});
                    reject(err);
                }
                else {

                    table_nameListed.push('serverroles');
                    resolve(result);
                }
            });
        });
        await serverroles;

        const serverlogs = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS serverlogs (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                channel BIGINT NOT NULL,
                eventtype TEXT NOT NULL
            )`, (err, result) => {
                if(err) {
                    console.error(err);
                    reject(err);
                }
                else {
                    table_nameListed.push('serverlogs');
                    resolve(result);
                }
            });
        });
        await serverlogs;
        const serverlogsignore = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS serverlogsignore (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                channel BIGINT NOT NULL
            )`, (err, result) => {
                if(err) {
                    console.error(err);
                    reject(err);
                }
                else {
                    table_nameListed.push('serverlogsignore');
                    resolve(result);
                }
            });
        });
        await serverlogsignore;

        const premiumKey = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS premiumkey (
                id SERIAL PRIMARY KEY,
                code BYTEA,
                guild BIGINT NOT NULL,
                generatedby BIGINT NOT NULL,
                createdat BIGINT NOT NULL,
                expiresat BIGINT NOT NULL,
                usesnumber INT,
                dedicateduser BIGINT,
                CONSTRAINT unique_guild_dedicateduser UNIQUE (guild, dedicateduser)
            )`, (err, result) => {
                if(err) {
                    console.error(err);
                    reject(err);
                }
                else {
                    table_nameListed.push("premiumkey");
                    resolve(result);
                }
            });
        });
        await premiumKey;

        const premiumMembersReg = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS premiummembers (
                id SERIAL PRIMARY KEY,
                member BIGINT NOT NULL,
                guild BIGINT NOT NULL,
                code BYTEA,
                customrole BIGINT,
                from_boosting BOOLEAN DEFAULT FALSE,
                CONSTRAINT unique_guild_member UNIQUE (guild, member)
            )`, (err, result) => {
                if(err) {
                    console.error(err);
                    reject(err);
                }
                else {
                    table_nameListed.push("premiummembers");
                    resolve(result);
                }
            });
        });
        await premiumMembersReg;

        const botConfigTable = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS botconfig (
                id BIGINT PRIMARY KEY,
                application_scope TEXT NOT NULL DEFAULT 'global',
                backup_db_schedule TEXT
            )`, (err, result) => {
                if(err) reject(err);
                table_nameListed.push('botconfig')
                resolve(result);
            });
        });
        await botConfigTable;
        const {rows: botConfigDefaultRow} = await poolConnection.query(`SELECT * FROM botconfig`);
        if(botConfigDefaultRow.length == 0) {
            const insertBotConfig = new Promise((resolve, reject) => {
                poolConnection.query(`INSERT INTO botconfig(id) VALUES($1)`, [process.env.CLIENT_ID], (err, result) => {
                    if(err) reject(err);
                    resolve(result);
                });
            });
            await insertBotConfig;
        }

        const banList = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS banlist (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                target BIGINT NOT NULL,
                moderator BIGINT NOT NULL,
                expires BIGINT NOT NULL,
                reason TEXT,
                CONSTRAINT unique_guild_target UNIQUE (guild, target)
            )`, (err, result) => {
                if(err) reject(err);
                table_nameListed.push('banlist')
                resolve(result);
            });
        });
        await banList;

        const punishlogs = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS punishlogs (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                target BIGINT NOT NULL,
                moderator BIGINT NOT NULL,
                punishment_type INT NOT NULL,
                reason TEXT NOT NULL,
                timestamp BIGINT NOT NULL
            )`, (err, result) => {
                if(err) reject(err);
                table_nameListed.push('punishlogs')
                resolve(result);
            });
        });
        await punishlogs;
        
        const autopunishrule = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS autopunishrule(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                warncount INT NOT NULL,
                duration BIGINT NOT NULL,
                punishment_type INT NOT NULL,
                punishment_duration BIGINT NOT NULL,
                CONSTRAINT unique_warncount_duration_guild UNIQUE (guild, warncount, duration)
            )`, (err, result) => {
                if(err) reject(err);
                table_nameListed.push('autopunishrule')
                resolve(result);
            });
        });
        await autopunishrule;

        let index = 1;
        for (x of table_nameListed){
            embed.addFields({name: `[${index}] - ${x}`, value: 'exists'});
            index += 1;
        }
        expectedTableNames = JSON.stringify(expectedTableNames.slice().sort());
        table_nameListed = JSON.stringify(table_nameListed.slice().sort());
        if(table_nameListed === expectedTableNames){
            await interaction.reply('The tables expected and the tables created are matching!');
        }
        else{
            await interaction.reply('Some of the default tables were not created correctly!');
        }
        
        return interaction.followUp({embeds: [embed.setDescription('Success').setColor('Green')]});
    }

};