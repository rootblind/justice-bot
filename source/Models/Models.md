# Models
Sources that represent the database tables.

Imported by `Models/modelsInit.js` to initialize the database tables.

- autopunishrule: These rules indicate the punishment and its duration to be applied for a member that has X warnings in the last Y time
- autovoicecd: The cooldown for a member to create a new Auto Voice channel
- autovoiceroom: Registry of all autovoices.The main use is to clean the channels even after bot restart
- autovoicemanager: Keeping the autovoice manager alive between bot restarts. Stores details necessary to initialize the collector
- autovoicechannel: Where the autovoice manager is located
- banlist: Stores current temporary bans and permanent bans (marked by expires = 0). Indefinite bans are not stored
- botconfig: Bot-related configuration for persistence between restarts
- customreact: Custom reactions of the bot to specific messages
- lfgblock: Keeps a track of who has whom blocked from their LFG party
- panelheaders: The names of the existing panels
- panelmessages: The message where the panel collector listens
- panelscheme: The functionality of each panel to give roles
- partydraft: Drafts/presets for creating a LFG party
- partyhistory: Registry of all parties created
- partymaker: The party manager details for collector persistence
- partyroom: Details about an existing party alongside the corresponding voice channel
- premiumkey: Active premium codes
- premiummembers: Active premium memberships
- punishlogs: Registry of all punishments applied to members
- rankrole: Roles corresponding to League of Legends roles (or game specific roles with proper system modification)
- reactionroles: The roles to be given when a person reacts with a specific emoji to the designated message
- serverlfgchannel: The channels used by the LFG system
- serverlogs: Channels used for logging events
- serverlogsignore: Channels to be ignored by logging
- serverroles: The roles corresponding to system-specific roles such as Staff and Premium
- staffroles: All the roles considered to be a guild's staff
- staffstrike: Warnings given to members with staffroles
- strikerule: Demote or kick a staff member when a specific number of strikes are given. Strikes expire
- ticketmanager: The manager for the ticket system
- ticketsubjects: The subjects that a member can use to create a ticket about
- welcomescheme: Welcome system settings such as the message to be went when a new guild member is added (joins the guild)