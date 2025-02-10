

const fs = require('graceful-fs');
const path = require('path');
const { botPermsCheckInChannel } = require('./utility_methods');

const commandCateogries = fs.readdirSync("./Commands"); // getting all commands folders
const commandsCategories = {};
const categoriesFields = [];
const categoriesMenu = [];

// formatting the commands categories for select menu and embed field object format
commandCateogries.forEach(category => {
    categoriesFields.push(
        {
            name: category,
            value: `${category} commands.`
        }
    );
    categoriesMenu.push(
        {
            label: category,
            value: category.toLowerCase(),
            description: `${category} commands`
        }
    );

    commandsCategories[category.toLowerCase()] = []; // initializing an object to pair commands and their categories
    const commands = fs.readdirSync(`./Commands/${category}`);

    commands.forEach((command) => {
        commandsCategories[category.toLowerCase()].push(command.slice(0, -3));
    })
});

function command_manual(command) {
    const fields = [];
    switch(command) {
        case "announcement":
            fields.push(
                {
                    name: "Category",
                    value: "Admin"
                },
                {
                    name: "Command",
                    value: "`/announcement` - Create and send a custom announcement"
                },
                {
                    name: "Subcommands",
                    value: `**simple-message** <send-as> <channel> <message> - Quickly send a simple announcement
                    **builder** - Customize an embeded announcement interactively`
                }
                
            )
        break;
        case "autopunish-rule":
            fields.push(
                {
                    name: "Category",
                    value: "Admin"
                },
                {
                    name: "Command",
                    value: "`/autopunish-rule` - Manage automatic punishment rules"
                },
                {
                    name: "Subcommands",
                    value: `**add** <warncount> <duration> <punishment-type> <punishment-duration> - Add a new rule. Rules are unique based on warn count and duration pair.
                    **list** - List all active auto punish rules and manage them.`
                }
            )
        break;
        case "infractions-admin":
            fields.push(
                {
                    name: "Category",
                    value: "Admin"
                },
                {
                    name: "Command",
                    value: "`/infractions-admin` - Administrate infractions."
                },
                {
                    name: "Subcommands",
                    value: `**list** <list-type> <user> - List the infractions of a user.
                    **lookup** <id> - Lookup details about a specific infraction on the server by its id.
                    **clear-list** <list-type> <user> - Clears the entire list specified from a user.`
                }
            )
        break;
        case "panel":
            fields.push(
                {
                    name: "Category",
                    value: "Admin"
                },
                {
                    name: "Command",
                    value: "`/panel` - Role panel manager"
                },
                {
                    name: "Subcommands",
                    value: `**default** - Create a set of default roles and adds them to a new panel.
                    **create** <new-panel> - Create a new panel
                    **delete** <panel-name> - Deletes an existing panel
                    **add-role** <panel-name> <role> <description> - Adds a role to a panel
                    **remove-role** <panel-name> <role> - Removes a role from the panel
                    **list** [panel-name] - Lists all panels on the server or details about a panel if specified
                    **send** <panel-name> [channel] [menu-description] - Sends the panel to the current channel or to the specified channel`
                }
            )
        break;
        case "premium-admin":
            fields.push(
                {
                    name: "Category",
                    value: "Admin"
                },
                {
                    name: "Command",
                    value: "`/premium-admin` - Administrative commands for the premium system"
                },
                {
                    name: "Subcommands",
                    value: `**key generate** [uses-number] [duration] [code] [dedicated-user] - Generates a key code with one usage, unlimited duration, randomly generated code and no dedicated user, unless specified otherwise.
                    **key remove** <code> - Deletes a key
                    **key edit** <code> [duration] [usesnumber] [dedicateduser] - Editing the key parameters. Omitting dedicateduser removes the current one.
                    **key list** [code] - Lists all keys or shows details if a code is specified
                    **membership assign-key** <member> <code> [from-boosting] [send-dm] - Assign premium membership to a user
                    **membership revoke** <member> [send-dm] - Revokes the membership of a user
                    **membership create-customrole** <member> <role-name> <hexcolor> [image-icon] [emoji-icon] - Creates and assigns a custom role to a premium member
                    **membership set-customrole** <member> <role> - Sets a role as the custom role of a premium member.
                    **membership display** [member] - Displays all premium members or details about the specified one.
                    **membership toggle-booster** <member> <from-boosting> - Toggle whether the premium membership is from server boosting or not
                    **migrate** - All server members that have the premium role and do not have a premium membership active, will have newly generated keys assigned to them.` 
                }
            )
        break;
        case "reaction-roles":
            fields.push(
                {
                    name: "Category",
                    value: "Admin"
                },
                {
                    name: "Command",
                    value: "`/reaction-roles` - Adds reactions to a message and assigns roles to members"
                },
                {
                    name: "Subcommands",
                    value: `**add** <channel> <message-id> <emoji> <role> - Add a reaction role to a message
                    **remove** <channel> <message-id> <emoji> - Removes the reaction role
                    **wipeall** - Remove all reaction roles from the server
                    **wipe-message** <channel> <message-id> - Removes all reaction roles from the message`
                }
            )
        break;
        case "role":
            fields.push(
                {
                    name: "Category",
                    value: "Admin"
                },
                {
                    name: "Command",
                    value: "`/role` - Create, edit, delete a role"
                },
                {
                    name: "Subcommands",
                    value: `**create** <role-name> <hexcolor> [image-icon] [emoji-icon] [position] - Creates the role
                    **delete** <role> [reason] - Deletes the role
                    **edit** <role> [role-name] [hexcolor] [position] [image-icon] [emoji-icon] - Edits the role
                    **assign** <member> <role> - Assigns the role to the member
                    **remove** <member> <role> - Removes the role from the member
                    **info** <info-role> - Information about the role`
                }
            )
        break;
        case "server-logs":
            fields.push(
                {
                    name: "Category",
                    value: "Admin"
                },
                {
                    name: "Command",
                    value: "`/server-logs` - Manages the events that are logged and in which channels"
                },
                {
                    name: "Subcommands",
                    value: `**set <event>** <channel> - Logs the event related activities inside the specified channel
                    **remove** <log-type> - No longer logs the specified event
                    **ignore** <channel> - Ignores all events related to the channel
                    **info** - Server logs settings`
                }
            )
        break;
        case "server-role":
            fields.push(
                {
                    name: "Category",
                    value: "Admin"
                },
                {
                    name: "Command",
                    value: "`/server-role` - Assign a specific function to a role"
                },
                {
                    name: "Subcommands",
                    value: `**set** <role-type> <role> - Assign the role type to a role
                    **remove** <role-type> - Deassigns a role type
                    **info** - Server role settings`
                }
            )
        break;
        case "unban-perma":
            fields.push(
                {
                    name: "Category",
                    value: "Admin"
                },
                {
                    name: "Command",
                    value: "`/unban-perma` <target> - Lift a permanent ban using admin privileges"
                }
            )
        break;
        case "welcome":
            fields.push(
                {
                    name: "Category",
                    value: "Admin"
                },
                {
                    name: "Command",
                    value: "`/welcome` - Configurate the welcome message"
                },
                {
                    name: "Subcommands",
                    value:`**set default** - Create a new channel or assigns any channel called "welcome" to leave the welcome messages into
                    **set custom-message** <welcome-channel> <message-description> [author] [message-title] [hexcolor] [image-link] - Creates the welcome channel and sends welcome messages with the specified parameters
                    **action** <take> - Enable/Disable the automatic welcome message or remove it entirely`
                }
            )
        break;
        case "botinfo":
            fields.push(
                {
                    name: "Category",
                    value: "Info"
                },
                {
                    name: "Command",
                    value: "`/botinfo` - Informations about the bot"
                }
            )
        break;
        case "infractions":
            fields.push(
                {
                    name: "Category",
                    value: "Info"
                },
                {
                    name: "Command",
                    value: "`/infractions` <member> - Look up someone\'s infractions"
                }
            )
        break;
        case "man":
            fields.push(
                {
                    name: "Category",
                    value: "Info"
                },
                {
                    name: "Command",
                    value: "`/man` <command> - Open the manual"
                },
            )
        break;
        case "serverinfo":
            fields.push(
                {
                    name: "Category",
                    value: "Info"
                },
                {
                    name: "Command",
                    value: "`/serverinfo` - Details about the server"
                }
            )
        break;
        case "userinfo":
            fields.push(
                {
                    name: "Category",
                    value: "Info"
                },
                {
                    name: "Command",
                    value: "`/userinfo` [user] - Details about the user"
                }
            )
        break;
        case "avatar":
            fields.push(
                {
                    name: "Category",
                    value: "Miscellaneous"
                },
                {
                    name: "Command",
                    value: "`/avatar` [user] - Displays the avatar picture of the user"
                }
            )
        break;
        case "ban":
            fields.push(
                {
                    name: "Category",
                    value: "Moderator"
                },
                {
                    name: "Command",
                    value: "`/ban` - Bans a user from the server"
                },
                {
                    name: "Subcommands",
                    value: `**indefinite** <target> <reason> [delete-messages] [apply-warn] - Indefinite bans last until it is manually removed
                    **temporary** <target> <duration> <reason> [delete-messages] [apply-warn] - Temporary bans for the specified duration
                    **permanent** <target> <reason> [delete-messages] [apply-warn] - Using administrator privileges to ban the user permanently.
                    **counter** - Counts the total number of banned users on the server
                    **check** <target> - Checks the details of a specific ban`
                }
            )
        break;
        case "unban":
            fields.push(
                {
                    name: "Category",
                    value: "Moderator"
                },
                {
                    name: "Command",
                    value: "`/unban` <target> <reason> - Lifts a temporary/indefinite ban"
                }
            )
        break;
        case "backup-db":
            fields.push(
                {
                    name: "Category",
                    value: "Owner"
                },
                {
                    name: "Command",
                    value: "`/backup-db` - Schedule database backup"
                },
                {
                    name: "Subcommands",
                    value: `**schedule set** <cron-expression> - Set a schedule
                    **schedule stop** - Stops the running schedule
                    **clear** - Clears all backup files
                    **dump** - Dumps all backup files in the current channel`
                }
            )
        break;
        case "bot-profile":
            fields.push(
                {
                    name: "Category",
                    value: "Owner"
                },
                {
                    name: "Command",
                    value: "`/bot-profile` - Configure bot profile"
                },
                {
                    name: "Subcommands",
                    value: `**presence default** - Set the configuration of presence to default-presence-presets
                    **presence custom-config** <config-json> - Provide a custom presence config
                    **presence auto-update** <toggle> [delay] - Toggle if presence is auto updated or not and the delay
                    **presence update** <activity-type> <activity-name> - Manually update the presence
                    **change-username** <new-name> - Change bot's username
                    **change-avatar** - Change bot's avatar`
                }
            )
        break;
        case "bot-scope":
            fields.push(
                {
                    name: "Category",
                    value: "Owner"
                },
                {
                    name: "Command",
                    value: "`/bot-scope` <toggle> - Change the application scope between test and global"
                }
            )
        break;
        case "cipher":
            fields.push(
                {
                    name: "Category",
                    value: "Owner"
                },
                {
                    name: "Command",
                    value: "`/cipher` - Encrypt and decrypt input using the keys"
                },
                {
                    name: "Subcommands",
                    value: `**encrypt** <data> - Encrypts the data
                    **decrypt** <data> - Decrypts the data
                    `
                }
            )
        break;
        case "default-database":
            fields.push(
                {
                    name: "Category",
                    value: "Owner"
                },
                {
                    name: "Command",
                    value: "`/default-database` - Set the default tables in the database"
                }
            )
        break;
        case "errors":
            fields.push(
                {
                    name: "Category",
                    value: "Owner"
                },
                {
                    name: "Command",
                    value: "`/errors` - Dump and delete error logs"
                }
            )
        break;
        case "fetch-db":
            fields.push(
                {
                    name: "Category",
                    value: "Owner"
                },
                {
                    name: "Command",
                    value: "`/fetch-db` <query> - Send a query to the database"
                }
            )
        break;
        case "label-message":
            fields.push(
                {
                    name: "Category",
                    value: "Owner"
                },
                {
                    name: "Command",
                    value: "`/label-message` <text> - Open the menu to label a text message"
                }
            )
        break;
        case "reload":
            fields.push(
                {
                    name: "Category",
                    value: "Owner"
                },
                {
                    name: "Command",
                    value: "`/reload` <commands|events|all> - Reloads the source files"
                }
            )
        break;
        case "shutdown":
            fields.push(
                {
                    name: "Category",
                    value: "Owner"
                },
                {
                    name: "Command",
                    value: "`/shutdown` - Terminates the process that the bot runs on."
                }
            )
        break;
        case "premium":
            fields.push(
                {
                    name: "Category",
                    value: "Premium"
                },
                {
                    name: "Command",
                    value: "`/premium` <dashboard|menu> - Opens the respective interface"
                }
            )
        break;
        case "timeout":
            fields.push(
                {
                    name: "Category",
                    value: "Staff"
                },
                {
                    name: "Command",
                    value: "`/timeout` - Manages timeout"
                },
                {
                    name: "Subcommands",
                    value: `**set** <user> <duration> <reason> [apply-warn] - Times out the user
                    **remove** <user> <reason> - Removes an active timeout`
                }
            )
        break;
        case "warn":
            fields.push(
                {
                    name: "Category",
                    value: "Staff"
                },
                {
                    name: "Command",
                    value: "`/warn` <member> <reason> [send-dm] - Warns the member"
                }
            )
        break;
    }
    return fields;
}

module.exports = {
    command_manual,
    commandsCategories,
    categoriesFields,
    categoriesMenu,
}