# utility_modules

Toolkits of methods for repetitive code

- cron_tasks: CronTaskBuilder objects imported by cronHandler to be initialized at clientReady event
- cronHandler: Loader for cron_tasks exports, builder to generate cron schedules from CronTaskBuilder objects and the initializer that iterates through the cron tasks to handle and start them
- discord_helpers: Methods related to DiscordAPI
- embed_builders: Builder methods for standard embed messages
- error_logger: winston error logger object and a handle method called async inside the catch block
- on_ready_tasks: OnReadyTaskBuilders to be imported by onReadyTasksHandler. On ready tasks are executed once at clientReady event
- onReadyTasksHandler: Contains the loader, builder and initializer for OnReadyTaskBuilders
- utility_methods: General scope methods that are not specific to Discord API