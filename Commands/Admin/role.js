/*
    Role Management
    This command is mostly from Lain bot, but with a few more input validation
*/
const {SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits} = require('discord.js');
const {config} = require('dotenv');
const fs = require('graceful-fs')
config();
module.exports = {
    cooldown: 2,
    testOnly: false,
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Create or delete a role.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand =>
                subcommand.setName('create')
                    .setDescription('Create a new role.')
                    .addStringOption(option =>
                        option.setName('role-name')
                            .setDescription('The name of the role.')
                            .setMaxLength(100)
                            .setRequired(true)
                    )
                    .addNumberOption(option =>
                        option.setName('hexcolor')
                            .setDescription('The hexcode of the role')
                            .setMinValue(0)
                            .setRequired(true)
                    )
                    .addAttachmentOption(option => 
                        option.setName('image-icon')
                            .setDescription('Upload an image as the role icon')
                    )
                    .addStringOption(option => 
                        option.setName('emoji-icon')
                            .setDescription('Emoji as role icon.')

                    )
                    .addNumberOption(option =>
                        option.setName('position')
                            .setDescription('The position of this role')
                            .setMinValue(1)
                )
            )
        .addSubcommand(subcommand =>
                subcommand.setName('delete')
                    .setDescription('Delete an existing role.')
                    .addRoleOption(option =>
                            option.setName('role')
                                .setDescription('Role to be deleted.')
                                .setRequired(true)
                        )
                    .addStringOption(option =>
                            option.setName('reason')
                                .setDescription('Give a reason.')
                                .setMaxLength(255)
                        )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('edit')
                .setDescription('Edit a role.')
                .addRoleOption(option =>
                        option.setName('role')
                            .setDescription('The role you want to edit.')
                            .setRequired(true)
                    )
                .addStringOption(option =>
                    option.setName('role-name')
                        .setDescription('The name of the role.')
                        .setMaxLength(100)
                )
                .addNumberOption(option =>
                    option.setName('hexcolor')
                        .setDescription('The hexcode of the role')
                        .setMinValue(0)
                )
                .addNumberOption(option =>
                        option.setName('position')
                            .setDescription('The position of this role')
                            .setMinValue(1)
                )
                .addAttachmentOption(option => 
                    option.setName('image-icon')
                        .setDescription('Upload an image as the role icon')
                )
                .addStringOption(option => 
                    option.setName('emoji-icon')
                        .setDescription('Emoji as role icon.')

                )
        )
        .addSubcommand(subcommand =>
                subcommand.setName('assign')
                    .setDescription('Assign a role to a member.')
                    .addUserOption(option =>
                        option.setName('member')
                            .setDescription('The member that will be assigned the role.')
                            .setRequired(true)
                    )
                    .addRoleOption(option =>
                            option.setName('role')
                                .setDescription('The role to be assigned.')
                                .setRequired(true)
                        )

        )
        .addSubcommand(subcommand =>
                subcommand.setName('remove')
                    .setDescription('Remove one role from a member.')
                    .addUserOption(option =>
                        option.setName('member')
                            .setDescription('The member that will be assigned the role.')
                            .setRequired(true)
                    )
                    .addRoleOption(option =>
                        option.setName('role')
                            .setDescription('The role to be assigned.')
                            .setRequired(true)
                    )
                    
            )
        .addSubcommand(subcommand =>
            subcommand.setName('info')
                .setDescription('Recieve informations about a role')
                .addRoleOption(option =>
                    option.setName('info-role')
                        .setDescription('The targeted role.')
                        .setRequired(true)
                )
        ),
        botPermissions: [PermissionFlagsBits.ManageRoles],
        userPermissions: [PermissionFlagsBits.ManageRoles],
        
        async execute(interaction)
        {
            const {options, guild} = interaction;
            const me = guild.members.cache.get(process.env.CLIENT_ID);
            const subCmd = options.getSubcommand(['create','delete', 'assign', 'remove', 'edit']);
            let name = options.getString('role-name');
            let color = options.getNumber('hexcolor');
            const role = options.getRole('role');
            const reason = options.getString('reason') || "No reason given.";
            const user = options.getUser('member');
            if(user)// making sure user is a member of the guild
            {
                if(!(await interaction.guild.members.cache.get(user.id)))
                    return await interaction.reply({ephemeral: true, embeds: [
                        new EmbedBuilder()
                            .setTitle('Invalid user')
                            .setColor('Red')
                            .setDescription('The user provided is not of this guild!')
                    ]});
            }
            let position = options.getNumber('position') || null;
            const imageIcon = options.getAttachment('image-icon') || null;
            let emojiIcon = options.getString('emoji-icon') || null;
            let roleIcon = null;
            const embed = new EmbedBuilder();
            if(imageIcon) {
                if(!imageIcon.contentType.includes('image'))
                    {
                        embed.setColor('Red').setDescription('The attachment provided is not an image!');
                        return interaction.reply({embeds: [embed], ephemeral: true});
                    }
    
                if(imageIcon.size > 262100) {
                    // the image is too large
                    embed.setColor('Red').setDescription('The image is too large! 256KB is the maximum size!');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }
                roleIcon = imageIcon.url;
               
            } else if(emojiIcon) {
                
                if(emojiIcon.match(/\d+/))
                    emojiIcon = emojiIcon.match(/\d+/)[0];
                else {
                    embed.setColor('Red').setDescription('Invalid emoji format!');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }
                try {
                    emojiIcon = await interaction.guild.emojis.fetch(emojiIcon);
                } catch(e) {
                    embed.setColor('Red').setDescription('Emoji not found on this server!');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }
                roleIcon = emojiIcon.imageURL();
            }
            
            if(position)
                if(position >= interaction.member.roles.highest.position && guild.ownerId !== interaction.member.id)
                {
                    embed.setColor('Red').setDescription('You can not edit a role\'s position to one higher than your role position!');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }
            if(color)
                if(color > 0xffffff)
                {
                    embed.setColor('Red').setDescription('The hexcolor is invalid!');
                }
            if(role)
            {
                if(interaction.member.roles.highest.position <= role.position && guild.ownerId !== interaction.member.id)
                {
                    embed.setColor('Red').setDescription('Your highest role is too low!');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }

                if(role.id == guild.roles.everyone.id)
                {
                    embed.setColor('Red').setDescription('You can not access @everyone');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }

                if(me.roles.highest.position <= role.position)
                {
                    embed.setColor('Red').setDescription('My highest role is too low!');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }
                // Excluding bot roles as valid inputs
                if(role.managed)
                {
                    embed.setColor('Red').setDescription('Bot roles are not manageable!');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }
            }

            let member;
            try{
                if(user)
                {
                    member = await guild.members.fetch(user.id);
                }
            }catch(err){
                if(user)
                {
                    embed.setColor('Red').setDescription('The user provided is not a member of this server!');
                    return interaction.reply({embeds: [embed], ephemeral: true});
                }
            }
            
            switch(subCmd){
                case 'info':
                    const infoRole = interaction.options.getRole('info-role');
                    embed
                        .setColor(infoRole.hexColor)
                        .setTitle(`Info about ${infoRole.name}`)
                        .setThumbnail(infoRole.iconURL({extension: 'png'}))
                        .addFields(
                            {
                                name: 'Created',
                                value: `<t:${parseInt(infoRole.createdTimestamp / 1000)}:R>`
                            },
                            {
                                name: 'Hexcolor',
                                value:`${infoRole.hexColor}`
                            },
                            {
                                name: 'Members',
                                value: `${infoRole.members.size}`
                            }
                        )
                        .setFooter({text:`Role ID: ${infoRole.id}`});
                break;
                case "create":
                    const newRole = await guild.roles.create({
                        name: name,
                        color: color,
                        permissions: [],
                        position: position,
                        icon: roleIcon
                    }).catch(err => console.log(err));
                    embed.setColor(color).setTitle('Role Created').setDescription(`**${newRole}** role has been created!`)
                        .setThumbnail(roleIcon);
                    break;
                case "delete":
                    embed.setColor('Green').setTitle('Role Removed').setDescription(`**${role.name}** has been removed!`);
                    await guild.roles.delete(role, [reason])
                        .catch(err => console.log(err));
                    
                    break;
                case "assign":
                    member.roles.add(role).catch(err => console.log(err));
                    embed.setColor(role.color).setTitle("Role Assigned")
                        .setDescription(`**${role.name}** has been assigned to **${member.user.username}**!`);
                    break;
                case "remove":
                    member.roles.remove(role).catch(err => console.log(err));
                    embed.setColor(role.color).setTitle("Role Assigned")
                        .setDescription(`**${role.name}** has been removed from **${member.user.username}**!`);
                    break;
                case "edit":
                    if(!roleIcon)
                        roleIcon = role.iconURL();
                    if(!position)
                        position = role.position;
                    if(!color)
                        color = role.color;
                    if(!name)
                        name = role.name;
                    embed.setColor(color).setTitle('Role Edited').setDescription(`**${role.name}** has been edited with the input provided now.`)
                        .setThumbnail(roleIcon);
                    await guild.roles.edit(role, {
                        name: name,
                        color: color,
                        position: position,
                        icon: roleIcon
                    });
                    
                    break;

                
            }

            return await interaction.reply({embeds: [embed]});

        }

}