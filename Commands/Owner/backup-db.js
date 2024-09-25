/*
    Manual database backup and scheduling backups
*/
const {SlashCommandBuilder, EmbedBuilder} = require('discord.js')
const poolConnection = require('../../utility_modules/kayle-db');
const {config} = require('dotenv');
const {exec} = require('child_process');
const fs = require('graceful-fs');
const path = require('path');
const cron = require('node-cron');
config();

const dumpDir = path.join(__dirname, '../../backup-db');

const username = process.env.DBUSER;
const database = process.env.DBNAME;
process.env.PGPASSWORD = process.env.DBPASS;

const cronRegex = /^((((\d+,)+\d+|(\d+(\/|-|#)\d+)|\d+L?|\*(\/\d+)?|L(-\d+)?|\?|[A-Z]{3}(-[A-Z]{3})?) ?){5,7})$/;

function generateName() {
    const date = new Date();
    return `kayle-db-bk-${date.toISOString().replace(/:/g, '-').slice(0,-5)}.sql`
}

async function createBackup() {
    const fileName = generateName();
    const command = `pg_dump -U ${username} -d ${database} -f ${path.join(dumpDir, fileName)}`
    
    const promise = new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if(err) reject(err);
            resolve(stdout.trim());
        });
    });
    await promise;
    return fileName;
}

let schedule = null;

async function schedule_backup(expression) {
    schedule = cron.schedule(expression, async () => {
        try{
            const backupFile = await createBackup();
        } catch(e) {
            console.error('Failed to create the scheduled backup: ', e);
        }
    }, {scheduled: true});
}

module.exports = {
    ownerOnly: true,
    cooldown: 10,
    data: new SlashCommandBuilder()
        .setName('backup-db')
        .setDescription('Backup database or schedule a cron task to do so.')
        .addSubcommand(subcommand =>
            subcommand.setName('now')
                .setDescription('Backup the current database right away.')
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName('schedule')
                .setDescription('Set and stop a scheduled cron task.')
                .addSubcommand(subcommand => 
                    subcommand.setName('set')
                        .setDescription('Set a schedule.')
                        .addStringOption(option =>
                            option.setName('cron-expression')
                                .setDescription('The cron expression to schedule the backup task.')
                                .setRequired(true)
                                .setMinLength(9)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('stop')
                        .setDescription('Stops the cron task scheduler if it is running.')
                )
                
        ),

    async execute(interaction, client) {
        const cmd = interaction.options.getSubcommand();

        switch(cmd) {
            case 'now':
                try{
                    const bkFile = await createBackup();
                    await interaction.reply({ephemeral: true, embeds: [
                        new EmbedBuilder()
                            .setTitle('Database backup executed successfully')
                            .setColor('Green')
                            .setDescription(`Backup file: ${bkFile}`)
                    ]});
                } catch(err) {
                    await interaction.reply({ephemeral: true, embeds: [
                        new EmbedBuilder()
                            .setColor('Red')
                            .setTitle('Error')
                            .setDescription('Database backup failed!')
                    ]});
                    console.error(err);
                }
            break;
            case 'set':
                const cronExpression = interaction.options.getString('cron-expression');
                
                if(!cron.validate(cronExpression))
                    return await interaction.reply({ephemeral: true, embeds: [
                        new EmbedBuilder()
                            .setTitle('Invalid cron expression!')
                            .setColor('Red')
                            .setDescription('The cron expression provided is invalid, a cron expression must look something like: `* * * * *`')
                   ]});
                await schedule_backup(cronExpression);
                await interaction.reply({ephemeral: true, embeds: [
                    new EmbedBuilder()
                        .setColor('Green')
                        .setTitle('Database backup schedule set up')
                        .setDescription(`Expression: \`${cronExpression}\``)
                ]})

            break;
            case 'stop':
                schedule.stop();
                await interaction.reply({ephemeral: true, embeds: [
                    new EmbedBuilder()
                        .setColor('Green')
                        .setTitle('Database backup schedule stopped...')
                        .setDescription('You\'ve stopped the cron task scheduler for the database backups.')
                ]});
            break;
        }
    }
}