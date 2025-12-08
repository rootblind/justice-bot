# Events
Events are scripts that execute every time the Discord API triggers the event of the same name as the script.

## Categories
Events are separated by categories based on where the event happens

- Client: Bot specific events
- Guild: Events related to guilds and guild specific objects such as members
- interactionCreate: Events triggered by Discord Interactions such as Slash Commands. Single event source category

## Client events
- clientReady: It's a once event that readies the bot's processes and systems in the first moment of it going online
- error: Handles uncaught errors specific to Discord API

## Guild events
All guild events log the action if there is a proper channel for that.
There are systems and other features that need to perform actions upon specific events triggering.

- channelCreate: Triggers when a channel is created
- channelDelete: Triggers when a channel is deleted
- channelUpdate: Triggers when a channel is changed, logging is done only for name changes
- guildAuditLogEntryCreate: Whenever a new audit log is created, this event is triggered. The bot handles timeout-related events and message deletion by means other than the bot
- guildBanAdd: Triggers when a member is banned
- guildBanRemove: Triggers when a user gets unbanned. Illegal removal of permaban is handled
- guildDelete: Triggers when a guild is either deleted or the bot gets kicked out of it
- guildMemberAdd: Triggers when a member joins the guild.
