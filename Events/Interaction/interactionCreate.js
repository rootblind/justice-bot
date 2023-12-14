const {CommandInteraction, PermissionFlagsBits, Collection} = require('discord.js');

module.exports = {
    name: 'interactionCreate',

    execute(interaction, client){
        
        if(interaction.isChatInputCommand())
        {
            if(interaction.guild === null) {
                return interaction.reply('Private commands are not available yet!');
                
            }

            const command = client.commands.get(interaction.commandName);
            const me = interaction.guild.members.cache.get(process.env.KAYLE_CLIENT_ID);
            
            // user based cooldown implementation https://discordjs.guide/additional-features/cooldowns
            const { cooldowns } = interaction.client; 
            // adding a cooldown collection for all the commands
            if(!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Collection());
            }

            const now = Date.now(); // the interaction is sent
            const timestamps = cooldowns.get(command.data.name); // the cooldown of the specific interaction
            const defaultCooldownDuration = 0; // the default cooldown duration in case it is not specifiend in the slash command
            const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

            // checking if user is in cooldown for the specified command
            if(timestamps.has(interaction.user.id)) {
                // calculates the cooldown expiration timer
                const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
                // checking if the cooldown expired and gives a reply if not
                if(now < expirationTime) {
                    const expiredTimestamp = Math.round(expirationTime / 1000);
		            return interaction.reply({ content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`, ephemeral: true });
	
                }
                
            }
            // if user isn't a key of the cooldown collection, then the user is added.
            timestamps.set(interaction.user.id, now);
            setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

            
            if(!command)
            {
                interaction.reply({content: "This is not an operable command!"});
            }
            command.execute(interaction, client);
        }
        else return;
        /*
        else if(interaction.isStringSelectMenu()){
            if(interaction.customId == 'reaction-roles')
            {
                for(let i = 0; i < interaction.values.length; i++)
                {
                    const roleId = interaction.values[i];
                    const has_role = interaction.member.roles.cache.has(roleId);

                    switch(has_role)
                    {
                        case true:
                            interaction.member.roles.remove(roleId);
                            break;
                        case false:
                            interaction.member.roles.add(roleId);
                            break;
                    }
                }

                interaction.reply({content: "Role updated", ephemeral: true});
            }
        }*/
    }
}