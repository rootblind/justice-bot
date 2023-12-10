const {poolConnection} = require('../../utility_modules/kayle-db.js');
const botUtils = require('../../utility_modules/utility_methods.js');
const {SlashCommandBuilder, Client, PermissionFlagsBits, EmbedBuilder} = require('discord.js');
const fs = require('fs');
const {config} = require('dotenv');
config();


// This command is to be run before using any of the bot commands that require a database connection.

module.exports = {
    data: new SlashCommandBuilder()
        .setName('default-database')
        .setDescription('Set the default tables in the database.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction, client){
        if(botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == 0)
            {
                console.error(`I am missing SendMessages permission in ${interaction.channel} channel.`);
            }
            else if(botUtils.botPermsCheckInChannel(client, interaction.channel, [PermissionFlagsBits.SendMessages]) == -1){
                const embed = EmbedBuilder()
                    .setTitle('An error occurred while running this command!')
                    .setColor('Red');
                return interaction.reply({embeds:[embed], ephemeral:true});
                
            }
        if(interaction.user.id != process.env.OWNER)
        {
            return interaction.reply({content: `You are not my master!`, ephemeral: true});
        }
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
        dbSerialization = new Promise((resolve, reject) => {
            poolConnection.query(`CREATE TABLE IF NOT EXISTS welcomescheme (
                id SERIAL PRIMARY KEY,
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
        await dbSerialization;
    

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