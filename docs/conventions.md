# Conventions

This document defines the architectural conventions of the project. It exists to ensure new features are implemented consistently, to simplify onboarding and to ensure good practices and the same format across different times and stages of development.

New code must follow these conventions unless exceptions are stated in this document or in other documentation.

It assumes familiarity with the architecture described in [`ARCHITECTURE.md`]((https://github.com/rootblind/justice-bot/blob/main/docs/architecture.md).

The structure and responsibilities of project components are listed inside the context of explaining a convention, no further details are given about the architecture. Instead, it defines in details how those components should be used and how new functionality
should be implemented.
## 1. General Principles

- Respect good practices of writing self documenting code before needing to comment it
- Prefer existing abstractions over direct library APIs
- Prefer building abstractions to wrap patterns that use multiple library APIs over using them directly
- Avoid introducing abstractions without a clear functional benefit.
- Do not duplicate infrastructure logic
- Prefer composition over inheritance

---

## 2. Hierarchy levels of guideline rules

| Level              | Meaning                     | Interpretation                                                      |
| ------------------ | --------------------------- | ------------------------------------------------------------------- |
| **Rule**           | Mandatory requirement       | **Must** follow unless there is a justified exception.              |
| **Guideline**      | Strongly preferred approach | **Should** follow. Deviations are acceptable when there's a reason. |
| **Recommendation** | Suggested best practice     | **May** follow, use judgment.                                       |

Each level will be explained below.

### 2.1 Rule

Do not break rules casually, those are architectural constaints. Rules must be followed unless there's either an exception specified or the rule hinders development in a significant way such as performance costs. When there's a justified case for breaking a rule, it must be documented to either be added as an exception or for the rule to be improved. 

Documenting a rule breaking or exception must be done by commenting the relevant block of code or source file, and under `docs/decisions/` by creating a new .md file respecting the following naming format `<incrementing the last file name>_<suggestive title>_<separated by underscores>.md`. Example: 0000_example_of_decision.md

### 2.1.1 Forbidden

The usage of the keyword "forbidden" when stating a rule should be interpreted as an absolute.

The only contributor authorized to modify conventions that forbid changes in specific locations is the author of this project [@rootblind](https://github.com/rootblind).

### 2.2 Guideline

A strong preference, but not absolute, guidelines should be respected unless there's a good reason not to.

Going against a guideline doesn't require a decision file, althought it is encouraged to document it, commenting the relevant file or block of code about the reason of breaking the guideline is mandatory.

### 2.3 Recommendation

Low enforcement guideline. May be used as advice.

Recommendations can be **reasonably** ignored for particular situations, but not entirely.

Documentation is not needed when recommendations are not followed.

### 2.4 Conventions

Rules, guidelines and recommendations are the conventions used to build this software (justice-bot). While there is room to go against them, following them is the way things are done in this project. They compose one consistent format which is valuable for scalability and mentenance.

---
## 3. Structural conventions and patterns

This section lists how things must, should and may be done as well as patterns to avoid.

Conventions are split based on the project's structure.

### 3.1 General rules

- Changing `justice.ts` (the main source) and `client_provider.ts` is strictly forbidden.
- Reuse existing abstractions first. Before implementing your own method or interface, check whether a standard implementation already exists in utility_modules or Interfaces. If the code belongs to a larger system, check the appropriate subdirectory under Systems first.
- Follow established patterns within the same system. When modifying or extending a system, follow the conventions and abstractions already used by that system before introducing a different approach.
- Prefer project abstractions over underlying libraries. If the project provides a wrapper or abstraction around a library, use the project abstraction instead of interacting with the underlying library directly unless there is a specific reason not to.
- Do not bypass project abstractions without a reason. Direct use of lower-level APIs is acceptable only when the existing abstraction cannot satisfy the requirement or when bypassing it is explicitly justified.
- Extend existing abstractions when appropriate. If an existing utility or system component is almost suitable but lacks required functionality, consider extending it before creating a separate implementation.
  For example if a method fetches the avatar of a GuildMember, but you need it to fetch the avatar of the User, an attempt should be made to add an optional parameter to the existing method in order to provide the output needed based on how the method is called.
- Keep shared functionality centralized. Functionality used across multiple systems should generally live in utility_modules or another appropriate shared location rather than being copied into individual systems.
- Keep system-specific functionality within its system. Do not move functionality into shared utilities merely because it is reusable once. Shared abstractions should represent genuinely common behavior.
- Do not introduce abstractions prematurely. A function does not need to become a utility or shared abstraction simply because it could theoretically be reused. Extract functionality when there is a clear need for reuse or a project convention requires it.
- Preserve the behavior of standardized abstractions. When using a project abstraction, do not work around its intended behavior by manually reproducing or overriding the behavior it is designed to provide.
- Document deviations from established patterns as mentioned in the 2nd section. If a requirement genuinely cannot be satisfied using the standard implementation, make the deviation explicit and document why the standard approach was not appropriate.

### 3.1 Locales and language

Justice-bot uses i18n for locales.

Implementing locales for commands is optional, but the default must always be in English whether locales are implemented or not.

Under the `scripts/` directory, locale_keys_sync can be used to sync the keys of a target json with the keys of a source json. This is a CLI tool that can be used to generate the necessary keys of a language after writing locales for another.

**Guideline**: The structure of locales should be prefixed to mirror the structure of the project where they are meant to be used. Exceptions are made for `common` and `dictionary` keys where general scope locales can be used across the project. Common is used for common messages while dictionary focuses on short, one to two words.

**Rule**: Use the `t()` function provided by `i18n.ts` under `Config/` instead of the library t function. For command names, descriptions, etc, use `getLocalizationRecord()` under the same source as t function.

### 3.2 Scripts

Only development tools go under this directory.

**Rule**: Do not call scripts anywhere else in the codebase, they are meant as tools to be used independent of the code.

Implementing your own scripts requires documentation under `docs/decisions/` where its scope and utility is described.
### 3.3 Commands

Commands build SlashCommandBuilder objects for Discord API to register, as well as defining the logic that needs to be executed when a user uses the command.

Structurally, they go under the `Commands/` directory where commands are categorized under specific subdirectories.

Categorization is based both on the user permission required to use the command and the kind of functionality the command provides. 

**Rule**: Creating a new command requires it's source to be in the appropriate subdirectory inside `Commands/`.

For example administrative commands that require Administrator permission are in `Administrator/`.  The miscellaneous category is for commands that either don't fit anywhere or can not be functionally placed in the same directory as other commands from the same system.

**Rule**: The source file of a command must be named exactly as the intended command name to be set for SlashCommandBuilder.

**Rule** Every command is implemented using `ChatCommand` interface located in `Interfaces/command.ts` and must follow the pattern:

```ts
const commandName: ChatCommand = {
	data: new SlashCommandBuilder()
		... // name, description, default permissions, locales, subcommands, etc
		.toJSON(), // must be converted to JSON for parsing
	metadata: {
		botPermissions: [],
		userPermissions: [],
		cooldown: ...,
		scope: "global", // or "guild"
		...
	},
	async execute(interaction, client?) {
		// The logic of this command
	}
}

export default commandName;
```

**Recommendation**: Name the object the same as the command. If the name is too short or might conflict with keywords, add "Command" as a suffix, for example: testCommand.

**Rule**: While an entire system shouldn't be forced under a single monolithic command, prioritize writing subcommands and subcommand groups under the same command over splitting functionality over multiple commands when there is no functional relevancy for the split. 

Example: While `/autovoice-admin` and `/autovoice-system` could be under the same root command, it's relevant to split the functionality of setting up autovoice systems and managing them (autovoice-system) from administrating existing systems (autovoice-admin) created by the former command.
#### 3.3.1 data

This is the part of the command that Discord API sees.

**Rules for naming**:
- The API limits names to 1-32 characters.
- Must match the source file.
- The only separator allowed is dash "-".
- Using the separator in naming must be prioritized over using a composed name.
- Avoid long command names by breaking them into subcommands, subcommand groups or separated commands with the same root name, if it's functionally viable.
- If multiple options are available for breaking a long command name, prioritize subcommands and subcommand groups, because the entire execution logic will be kept inside the same source.
- The name of a command, subcommand or subcommand group must be as simple and as suggestive as possible while keeping it short.

**Rule**: The same rules from above apply within the same command when it comes to subcommands and subcommand groups. When multiple subcommands refer to the same kind of tasks, structure them under a parent subcommand group.

**Recommendation:** Command descriptions are limited to 1–100 characters, so they should remain concise and communicate the highest-level purpose of the command. Detailed usage instructions should not be embedded in the description.

If a command requires additional explanation, consider implementing a dedicated informational or helper subcommand that provides a more detailed explanation of the command's purpose and usage, for example through an embed.

Alternatively, the command can provide contextual guidance when the user first supplies invalid or incomplete input, explaining the expected format and how the command should be used.

**Guideline**: If a command performs a single action, usage of subcommands and subcommand groups should be avoided unless there is intent to extend the command's functionality.

Similarly, avoid introducing subcommand groups  for a single subcommand.

**Recommendation**: Try to structure subcommands and subcommand groups consistently within the same command.

Example from `/premium`

Good structure:

```ts
const premiumCommand: ChatCommand = {
	data: new SlashCommandBuilder()
		.setName("premium")
		.setDescription("Manage and see your premium status and perks.")
		.addSubcommand(subcommand =>
			subcommand.setName("profile")
				.setDescription("Show your premium profile page.")
		)
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup.setName("role")
				.setDescription("Custom role related commands")
				.addSubcommand(subcommand =>
					subcommand.setName("panel")
						.setDescription("Open the panel to [...]")
				)
				.addSubcommand(subcommand =>
					subcommand.setName("invite")
						.setDescription("Invite another member to [...]")
						.addUserOption(option =>
							option.setName("user")
							.setDescription("The user to be invited.")
							.setRequired(true)
						)
				)
		)
		.toJSON(),
	[...]
}
```

Bad structure:

```ts
const premiumCommand: ChatCommand = {
	data: new SlashCommandBuilder()
		.setName("premium")
		.setDescription("Manage and see your premium status and perks.")
		.addSubcommand(subcommand =>
			subcommand.setName("profile")
				.setDescription("Show your premium profile page.")
		)
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup.setName("role")
				.setDescription("Custom role related commands")
				.addSubcommand(subcommand =>
					subcommand.setName("panel")
						.setDescription("Open the panel to [...]")
				)
		)
		.addSubcommand(subcommand =>
			subcommand.setName("role-invite")
			// or even just "invite" 
			// inviting what?
				.setDescription("Invite another member to [...]")
				.addUserOption(option =>
					option.setName("user")
					.setDescription("The user to be invited.")
					.setRequired(true)
				)
			)
		)
		.toJSON(),
	[...]
}
```

**Rule**: Default Member Permission must be set to the highest permission required to run the command.

When it comes to options, the same conventions and principles should be applied in common areas.

#### 3.3.2 metadata

Metadata is a `ChatCommandMetadata` object from the same source as `ChatCommand`. It's used to define what kinds of checks must a command pass before execution, what other permissions are required, as well as specific ways the command is handled.

```ts
export interface ChatCommandMetadata {
	botPermissions: PermissionResolvable[],
	userPermissions: PermissionResolvable[],
	cooldown: number,
	scope: "global" | "guild",
	group?: ChatCommandGroup,
	category?: ChatCommandCategory,
	ownerOnly?: boolean,
	testOnly?: boolean,
	premiumPlanOnly?: boolean
	disabled?: boolean
}
```

- botPermissions and userPermissions:
  The anticipated permissions required for the bot to execute the command, as well as the permissions enforced for usage by a user.
- cooldown:
  The minimum number of seconds a user must wait before using the same command again.
- scope:
  The scope of a command represents whether the command can be toggled off within individual guilds or if it's meant to be globally exposed.

**Guideline**: Set the scope to "guild" for commands of non essential systems and to "global" for essential commands and commands that use a very basic functionality of Discord API.

For example,  /lfg-system has a "guild" scope while /botinfo or /serverinfo have a "global" scope.

**Rule**: Commands from the same system must have the same command scope and group across all commands.

- group:
  Groups are defined by the string union `ChatCommandGroup`. Groups are used to tie together commands of different categories and permission levels that operate under the same system. Therefore a group can be seen as the system a command is part of.

  Not all systems have a defined group, but each group corresponds to a system.

  **Rule**: Reiterating the rule above, all commands within a system must have the same group. Also, global scope commands must have their group set to "global" as well.

  Code snippet of `ChatCommandGroup`:

```ts
// This snippet might be outdated, but it's used as an example and to visualize
// the structure
export const CHAT_COMMAND_GROUPS = [
    "global",
    "premium",
    "autovoice",
    "block",
    "lfg",
    "moderation",
    "ticket"
] as const;

export type ChatCommandGroup = typeof CHAT_COMMAND_GROUPS[number];
```

   **Rule**: In order to add a new command group, you must add its name inside `Interfaces/command.ts` just like the other group names.
   Naming a group must be done all lower case and the only separator allowed is dash "-".


   Guideline: Even though group is an optional parameter, you should set one. If no group is provided, the command group will default to "global".

- category:
  Categories are defined by the string union `ChatCommandCategory`. 

  A category is directly represented by the command subdirectory the command is located.

  Categories tie together commands under the same directory and of a similar permission level and intended use.

  **Rule**: Commands must match the category name with the directory their source file is

Code snippet of `ChatCommandCategory`:

```ts
// This snippet might be outdated, but it's used as an example and to visualize
// the structure
export const CHAT_COMMAND_CATEGORIES = [
    "Info",
    "Administrator",
    "Owner",
    "Social",
    "Staff",
    "Moderator",
    "Miscellaneous",
    "Premium"
] as const;

export type ChatCommandCategory =
    typeof CHAT_COMMAND_CATEGORIES[number];
```

**Rule**: In order to add a new command category, you must add its name inside `Interfaces/command.ts` just like the other category names. Then you must create a subdirectory under `Commands/` to match the category name. 
Naming rules: must start with a capital letter, the other letters must be lower case, the only separator allowed is underscore "\_", if the category name contains multiple words separated by underscore, each first letter must be capitalized.

- ownerOnly: marks a command to be restricted only to the defined owner of the bot
- testOnly: marks a command to be restricted only to the defined test discord server
- premiumPlanOnly: marks a command to be restricted only for guilds with a premium plan (functionality not implemented yet)
- disabled: marks a command to be ignored by the command handler and loader to effectively disable it

#### 3.3.3 interactionCreate

Even though interactionCreate is an event and as an API callback, it handles more than just SlashCommands, it's part of the execution flow of ChatCommands as well.

interactionCreate acts as a validation layer between calling a SlashCommand and it's execution method. Only the relevant parts will be analyzed to provide context of how metadata is used when a command is called.

interactionCreate ensures the following checks before a command can execute:
- Validates the guild premium plan for premiumPlanOnly commands.
- Staff and Moderation category commands are guaranteed to run only if a Staff server role exists and the member has the Staff role assigned.
- Commands in the premium group are guaranteed that Premium server role exists and the member has premium membership if the command also has Premium category
- Commands set to ownerOnly have the ID of the member compared to the bot owner id.
- userPermissions and botPermissions are iterated and compared to those of the member and the bot, guaranteeing execution is reached only if permissions are present.
- Comands set to testOnly have the ID of member's guild compared to the test server (home server)
- Command cooldowns are checked and managed
- `command.execute()` is called inside a try-catch block for unexpected errors

**Guideline**: If your category or group requires checks and validations across all commands, those should be implemented inside interactionCreate instead of having each individual command perform the exact same checks.

#### 3.3.4 execute

The functional part of a ChatCommand is the execute function which takes `interaction` and optionally the bot client object.

**Recommendation**: At the top of the method, declare the data that will be used across the entire command and shorthands for commonly used interaction components like in the following example:

```ts
// interactionCreate ignores non guild (DM) commands
// so interaction.member is guaranteed to exist
const member = interaction.member as GuildMember;
const guild = interactionMember.guild;

const options = interaction.options;
const subcommand = options.getSubcommand();
const subcommandGroup = options.getSubcommandGroup();

const logChannel = await fetchLogsChannel(guild, "premium-activity");
```

**Rule**: Handling subcommands and subcommand groups is done using switches

**Exception**: If the command has exactly two subcommands in total and there is no intention to add more in the future, the if-statement can be used.

Examples of how to handle subcommands and subcommand groups:

```ts
switch(subcommand){
	case "subcommand1": {
		...
		break;
	}
	case "subcommand2": {
		...
		break;
	}
	...
}
```

```ts
switch(subcommandGroup) {
	case "group1": {
		// subcommand group wide validations
		...
		switch(subcommand) {
			case "sub1_group1": {
				...
				break;
			}
			case "sub1_group2": {
				...
				break;
			}
		}
		break;
	}
	case "group2": {
		switch(subcommand) {
			...
		}
		break;
	}
	case null: {
		// subcommands that are not under any subcommand group use null as value
	}
}
```

**Guideline**: Keep command source files under 1000 lines of code. For large commands, keep only the top-level code that calls the abstract methods that perform the actual execution.

**Recommendation**: When a command goes over 1000 lines of code or seems like it would from the beginning, it is encouraged to create a system subdirectory with a suggestive name and to split the execution logic into modular methods and source files. Or to create a single source file inside `Systems/components/` where the heavy logic of the command lives.

**Recommendation**: For large commands, treat subcommands as individual commands within command's system. It is adviced to organize large subcommand logic in its own methods that can be called at top-level by the command switch to execute.

Example

```ts
switch(subcommand) {
	case "subcommand1": {
		// instead of the code or having just minimal code inside this block
		// we call the subcommand top-level method
		
		await subcommand1_method(interaction, ...);
		// in order to reply outside command's source file
		// interaction must be passed as parameter
		break;
	}
}
```


### 3.3.5 Server roles and Server objects

This section is a foot note for context.

When the documentation or the code mentions server roles, server channels or anything else with a similar tag, it means that the bot uses those objects for functional purposes.

Server roles are defined on a guild basis by administrators using `/server-roles` to manage them.

Server roles are used to enable systems that require the bot to know that a specific role has special functions throughout systems.

For example, staff role enables staff commands to be used by staff members whom do not need permissions directly inside the discord server. Or even a greater use case is within features provided by the bot where permissions need to be handled manually. 

For example, the staff role prevents a staff member from being excluded from autovoice channels,

## 3.4 Config

Under the `Config/` directory are configurable dependencies of the bot, such as the database and the custom caching system.

**Rule**: Changes of sources under the config directory are forbidden. 

Adoption of a new dependency that requires a configuration source file is done under `Config/`.

SelfCache is a custom caching system that stores data in a map using key-value pairs. Check its source file for details.

Example of usage:

```ts
const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
const cache = new SelfCache<string, string>(ONE_HOUR);
const memberName = cache.get(member.id);
if(!memberName) cache.set(member.id, member.displayName);
```
## 3.5 Events

Discord event callbacks are defined under this directory, being split in subdirectories based on the subject that triggers the event.

- Client: Bot User related events
- Guild: Events about server activity and its members
- interactionCreate: Triggered whenever an interaction is fired, its usage was discussed above in the Command subsection

All events have a hook system implemented as shown below using the error event:

```ts
export type errorEventHook = (error: Error) => Promise<void>;
const hooks: errorEventHook[] = [];
export function extend_errorEvent(hook: errorEventHook) {
    hooks.push(hook);
}

async function runHooks(error: Error) {
    for (const hook of hooks) {
        try {
            await hook(error);
        } catch (error) {
            await errorLogHandle(error);
        }
    }
}


const errorEvent: Event = {
    name: "error",
    async execute(error: Error) {
        const message = undefined;
        const title = undefined;
        errorLogHandle(error, message, title, false);
        await runHooks(error);
    }
}

export default errorEvent;
```

**Rule**: Attaching an event hook must be done inside `utility_modules/event_hooks.ts`. For further instructions, go down to the **3.15 Utilities** section.

**Recommendation**: If the hook involves a lot of code, create a system subdirectory or a component source file under `Systems/components/` where the heavy logic is done and that can be called by the event hook instead.

**Rule**: Adding a new event must be done by creating a source file under the right Events subdirectory (as categories were described in this section), naming the file using the Discordjs API name of the event and then using the pattern from the snippet above to implement the event using `Event` interface alongside its hook system.

In order to extend the functionality of an event callback, the source file can be edited as well as attaching an event hook as stated by the rule further above in this section.

**Rule**: Avoid increasing the line count of event files above 1000.

**Guideline**: Functionality that goes further than a few API calls should be extended by implementing the logic in a system or system component and calling the top-level methods inside the event.
### 3.5.1 Client

Events implemented:
- error
  Catches and logs errors that trigger the Discord API event
- clientReady
  This event is triggered once per session, when the bot goes online and pings Discord servers.
  In this project, inside clientReady checks and validations are done to prepare the bot for the current session while making sure the database is setup and ready and cleanups are done for the uncaught events that invalidate data (roles stored in database being deleted while the bot is offline for example).

clientReady performs the following:
- Ensures that the Client object was instantiated
- Initializes database tables
- Initializes directories used for storage
- Runs and awaits a gateway stability check attempting to fill the API caches
- Loads and executes OnReadyTasks
- Loads CronTasks and event hooks
- Attaches collectors
- Sets the bot presence from the configuration json
- Ensures .csv files for collecting toxic messages exist
- Runs its own hooks through the hook system
- And finally, logs in console the fact that the bot is online

### 3.5.2 Guild

Events used mainly for the logging system, to clean up database rows upon objects being deleted (such as roles, channels, messages, etc) and to facilitate executing logic for systems that require reactive responses (such as autovoice that needs to now members voice states).

### 3.5.3 interactionCreate

**Rule**: Implementing execution logic of a specific interaction inside this event is forbidden. All interactions must be implemented in other sources for interactionCreate to react to and call.

As of now [08.08.2026] interactionCreate handle only slash commands, while other interactions are handled locally using collectors (listeners).

## 3.6 Handlers

Under this directory are the sources that load and register commands and events through the Discord API.

**Rule**: Changes of sources under this directory is forbidden.

Should be read as reference for how ChatCommands and Events get from written code to functional parts of the bot.

## 3.7 Interfaces

Reusable interfaces are declared inside the sources of this directory.

**Recommendation**: Write interfaces locally when needed just for typing and type checking, inside a system-related source when the interface is used inside that system only and declare interfaces under `Interfaces/` sources when they can be used by multiple systems, commands and events of the bot.

**Recommendation**: Try to fit your interfaces in an existing category source under this directory before creating a new file.

**Guidelines for placing interfaces**:
- command should be changed only when there's a need to add a new group or category
- event shouldn't be changed at all
- database_types should only have declarations of types and interfaces related to the database tables
- server_types are for webserver related types
- helper_types are for everything else


## 3.8 lolro_pack

Justice-bot is the dedicated bot for League of Legends Romania, as some needs are specific to League of Legends or to the discord server, there are features and implementations that use resources from this pack.

Adding or modifying the contents of this directory must be done respecting the conventions stated in this document.


## 3.9 Models

Models are the code equivalent of database tables.

**Rule**: Creating database tables is done by creating a source file under `Models/`.

**Guideline**: The name of the model file should be the same as the table or the system of tables it represents.

**Rule**: Declaring a model inside the model source file must respect the template:

```ts
import type { Result } from "pg";

import database from '../Config/database.js';
import type {  } from "../Interfaces/database_types.js";

export default async function Table(): Promise<Result<TableInterface>> {
    try{
        const result: Result<TableInterface> = await database.query(
            `CREATE TABLE IF NOT EXISTS table_example(
	            primary_key_column,
	            column_1,
	            column_2,
	            etc
            );`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}
```

This example can be found at `Models/.model.example.txt`.

**Rule**: The only query operation allowed inside models is `CREATE TABLE IF NOT EXISTS`.

**Guideline**: Declaring multiple tables of the same system should be done inside the same model source file.

Using `Models/ticketsystem.ts` as an example:

```ts
import database from '../Config/database.js';

// the query was removed to reduce the screen space this example takes.
export default async function TicketSupportSystem(): Promise<void> {
    try {
        await database.query(
            `CREATE TABLE IF NOT EXISTS ticketmanager(...)`
        );

        await database.query(
            `CREATE TABLE IF NOT EXISTS ticketsubject(...)`
        );

        await database.query(
            `CREATE TABLE IF NOT EXISTS openticket(...)`
        );
    } catch (error) {
        console.error(error);
        throw error;
    }
}
```

**Guideline**: Good practices of declaring primary keys, foreign keys, constraints and data types should be applied while declaring a new table.

**Rule**: Implement appropriate interfaces for your tables. Each database table must have 4 representations, one in the database, one as a model source and one as an interface.

Check `Models/modelsInit.ts` to understand how models are loaded into having the query code executed.

`modelsInit()` is called inside clientReady event.

**Rule**: Changes to `modelsInit.ts` is forbidden.

**Rule**: Each table or system of tables must have a repository singleton class.

Repository conventions and guidelines are at the section below, 3.10.
## 3.10 Repositories

Repositories are the communication layer between the database and the rest of the codebase.

**Rule**: The only source files that are allowed to send queries directly to the database are the ones under this directory.

In order to send requests to the database from a command, for example, the appropriate repository object must be imported and have the corresponding method called.

Usage of SQL outside repositories and models is strictly forbidden.

**Rule**: Implementing a repository must be done by creating a source file under `Repositories/` with the exact name as the table or system of tables model file.

**Rule**: Repositories must be singleton classes as shown in the snippet below:

```ts
import database from "../Config/database.js";
import { ExampleTable } from "../Interfaces/database_types.js";

class ExampleRepository {
	async getAll(): Promise<ExampleTable[]> {
		const {rows: data} = await database.query<ExampleTable>(
			`SELECT * FROM example_table;`
		);
		
		return data;
	} 
}

const ExampleRepo = new ExampleRepository();
export default ExampleRepo;
```

- The class name must be the same as the source file suffixed with "Repository"
- The singleton object name must be the same as the source file suffixed with "Repo"
- Each first letter must be capitalized
- The query method must be provided with the returning type

The following pattern:
```ts
const {rows: data} = await database.query<>();
```

Is prefered over
```ts
const result = await database.query<>()
```

Unless metadata about the response is needed.

**Rule**: Even if a query is required by a single line inside the whole codebase, the repository pattern must be enforced and the query to be declared as a method inside the appropriate repository class.

**Guideline**: The name of repository methods should be camel case, prefixed with the expected operation of the method and have a suggestive name about the kind of data or overall operation it performs and the table it performs on.

Longer names are acceptable to achieve clarity.

**Rule**: Repository methods that are supposed to fetch a single row must return null if no row was found.

In the case of an array being expected, an empty array must be returned in the case of no rows being found.

**Guideline**: Caches should be implemented to reduce the stress put on the database. And caching should be done through the SelfCache class.

**Recommendation**: Implement caches in time for repositories of systems that have been extensively tested and proved no need for changes. That way caching can be done without the question if a problem comes from the logic of handling data or caching.

## 3.11 objects directory

Runtime constants and configuration json files required by the bot to easily load custom configuration outside the database and have paths pre-loaded.

**File declarations**:
- enums go inside `enums.ts`
- `plans.ts` are related to Guild Premium System and premium guild only commands, which are not implemented yet, but this source file is supposed unchangeable benefits configured as constants
- `trigger_words.ts` contains base string for the regex engine used for toxicity and offensive language detection
- `local_config.ts` compiles constants in a structured manner easy to access wherever needed

**Recommendation**: Frequently used paths inside the project directory may be added to local_config for easy of access.


## 3.12 server

This sections refers to the webserver of the bot.

As of now, further development is needed on the web application end.

No conventions as of yet.


## 3.13 Systems

Across this documentation, systems and the `Systems` directory have been regularly  mentioned as a solutions or containers for extensive lines of code.

In the philosophy of this project, a system is a functional collection of components that perform specific tasks, are agnostic to the top-level environment where they are called and offer the ports needed to be called anywhere (slash commands, button interactions, etc).

Most frequently, systems are used for abstraction of large commands and menus to keep the code organized and under a manageable scrolling length across the codebase.

Under `Systems/components/` single source systems with general purpose use-case can be implemented.

**Guideline**: Add new systems with a specific scope by creating a subdirectory under `Systems/` and create system-related source file in it.

General purpose builders, libraries, abstraction of reusable patterns meant to build multiple features should go in `Systems/components/`.

## 3.14 types

Contains declarations of types for dependencies that lack @types.

Add `.d.ts` as needed for dependencies used.


## 3.15 Utilities

Provides bot-wide abstractions and standardized implementations. Unlike Systems, which encapsulate feature-specific functionality, utility modules provide functionality intended to be reusable across unrelated features.

Compareable to systems which are collections of components to be used for feature implementation, the sources under `utility_modules` could be seen as the gears that make up the components.

- error_logger provides the standard error logging in this project with the default option to send a discord DM as a notification to the owner of the bot.
- utility_methods is the general purpose toolkit that contains useful and standardized patterns that work with generalized data rather than calling Discord APIs
- discord_helpers is the general purpose toolkit that works exclusively with Discord APIs, offering standardized patters of the approved ways to handle requests API from and to Discord

**Rule**: If your utility fetches directly from Discord or awaits Discord requests, it belongs in `discord_helpers.ts`. If it simply works computes local data, it belongs in `utility_methods.ts`.

**Rule**: No duplication of implementations are allowed. Check if the utility you intend to write already exists.

- OnReadyTasks are functional objects that define a conditional task that needs to be ran once per bot session at clientReady event.

  The pattern is implemented through the OnReadyTaskBuilder interface
  
```ts
/**
 * @param name The name of the task
 * @param task The function that will be executed
 * @param runCondition The condition for the task() method to be executed
 * @param fatal (Optional) Whether the bot should shutdown in the event that task or runCondition throw errors
 */
interface OnReadyTaskBuilder {
  name: string,
  task: () => Promise<void>,
  runCondition: () => Promise<boolean>,
  fatal?: boolean
}
```

  General scope OnReadyTasks are implemented  inside the source `on_ready_task.ts`.

  `onReadyTasksHandler.ts` in responsible for providing the source loader and execution of OnReadyTasks respecting the runCondition and catching uncaught errors.

  This way, event hooks and attaching persistent message collectors can reuse this pattern to run specific tasks at clientReady event.

  **Rules**: 
  - Persistent collectors are attached using OnReadyTask pattern in `attach_collectors.ts`
  - Event hooks are implemented using OnReadyTask pattern in `event_hooks.ts`
  - General OnReadyTasks are implemented in `on_ready_tasks.ts`
  - If there's a need for a new category of OnReadyTasks, the source must be created with a suggestive name under `utility_modules/`. Loading them must be done through onReadyTasksHandler methods at clientReady event as in the snippet below

```ts
// on ready tasks
if (local_config.sources.on_ready_tasks) {
    try {
         const onReadyTasks = await load_onReady_tasks(
	         local_config.sources.on_ready_tasks
         );
	    if (onReadyTasks) {
		    await on_ready_execute("On Ready Tasks", onReadyTasks);
		}
    } catch (error) {
        await errorLogHandle(error, "", "Fatal error");
        setTimeout(() => process.exit(1), 5_000);
    }
}
```

**Guideline**: Add the path of your new OnReadyTask category source file to local_config.

- CronTasks use a similar pattern to OnReadyTasks
  CronTasks are implemented through the following interface
```ts
/**
 * @param name The name of the task
 * @param schedule CronString for scheduling the cron task
 * @param job Async function to execute as the cron's task job
 * @param runCondition Async function to start the cron task if true or to pause it if it returns false
 * 
 * Interface for objects to be used in the cron_task_loader
 */
interface CronTaskBuilder {
  name: string,
  schedule: CronString;
  job: () => Promise<void>;
  runCondition: () => Promise<boolean>

}
```

  CronTaskBuilder pattern is a wrapper for node-cron API.

  CronTasks are implemented in `cron_tasks.ts` and `cronHandler.ts` provides the loader for the source file and the builder method that creates node-cron tasks for each CronTask and ensures standardized checking for the runCondition parameter and executing the `job()` method inside a try-catch block to catch unexpected errors.

  **Rule**: Adding CronTaks must be done inside `cron_tasks.ts`.

  Multiple categories of CronTasks could be implemented similarly to OnReadyTask by repeating snippet below for your own CronTask category source file.

```ts
// cron tasks
if (local_config.sources.cron_tasks) {
    try {
        const cronTasks = await load_cron_source(
	        local_config.sources.cron_tasks
	    );
        if (cronTasks) await init_cron_jobs(cronTasks);
    } catch (error) {
        await errorLogHandle(error, "", "Fatal error");
        setTimeout(() => process.exit(1), 5_000);
    }
}
```
   
**Rule**: Changing utility handlers behavior is forbidden.

- button_builders and embed_builders are pre-built templates to be used instead of creating new objects manually using the same format every time

  **Guideline**: Use `embed_message()` and `embed_error()` when replying to the user, unless a more complex response is needed.

  **Recommendation**: Add reusable embeds and buttons in `button_builders.ts` and `embed_builders.ts`. But declaring new objects wherever needed is also acceptable.

  **Rule**: Adding new templates or ready to use objects in those sources must be implemented through a method.

- regex_classifier is the regex engine used to build regex patterns from `objects/trigger_words.ts` and to provide toxicity classification methods

---

## 5. Usage of assertion operators

**Rule**: Non-null assertion can be used only when another piece of code ensures that the value you're trying access and use is not null. In this case, the "!" is allowed only to calm the compiler, not to skip necessary validation.

```ts
const {rows: data} = await database.query<>(
	`INSERT INTO table(id, guild, ...)
	VALUES($1, $2, ...)
	RETURNING *;`
);

// RETURNING ensures that one row is returned and it exists
return data[0]!;
```

**Rule**: Prefer explicit validation checks over non-null assertion. Use non-null assertion only when checks have already been done but the compiler doesn't know about them.

**Rule**: Document in comments usage of non-null assertion for the reason why further validation is not needed.

```ts
if (!attachment.contentType?.includes("image"))
```

**Recommendation**: Use optional chaining when a value is legitimately optional and undefined is an expected result.

**Rule**: Do not use optional chaining to avoid handling a value that is required for the operation. If its absence indicates invalid state or a programming error, handle it explicitly.

Avoid:

```ts
const roleName = interaction.member?.roles.cache.get(roleId)?.name;
```

Conceptually better:

```ts
if(!interaction.member) {
	// handle
	return;
}

const role = interaction.member.roles.cache.get(roleId);

if(!role) {
	//handle
	return;
}

await interaction.reply(`Role name: ${role.name}`);
```

Using standard convention patterns:

```ts
const guild = await fetchGuild(client, guildId);
if(!guild) {
	//handle
	return;
}
const role = await fetchGuildRole(guild, roleId);
if(!role) {
 // handle
 return;
}

await interaction.reply(`Role name: ${role.name}`);
```

**Rule**: Type assertion has the same conventions as non-null assertion. It must be used only when another piece of code guarantees the type so further validation to calm down the compiler are redundant.

```ts
// interactionCreate ensures only guild interactions are executed
const member = interaction.member as GuildMember;
```

**Guideline**: Document in comments usage of type assertion where it's less obvious, or a less common mechanism ensures the type.

**Rule**: None of these operators should be used to avoid relevant validation.

---

## 5. Commenting rules

- Top-level abstract methods must have their functionality, parameters and expected effects well documented. There must never be a case where a method's behavior can not be predicted without reading its implementation.
- Going against rules and guidelines must be documented in comments as well.
- Usage of non-null assertion operator must be reasoned.
- Usage of type assertion operator must be reasoned when used in uncommon scenarios
- Commenting lines and blocks of code must be done only if it makes the code more readable, not in an excessive manner.
- Comments must document good code, not to be a crutch for bad and unreadable code. Consider re-writing the code or its structure in those scenarios.

---

## 6. Error Handling

Every entry point of the bot that can execute code is wrapped at multiple levels in a try-catch block.

Fatal errors that are handled by logging them and shutting down the bot process are at clientReady event if something essential fails the checks.

**Rule**: When catching errors, log them by calling `errorLogHandle()`.

**Rule**: If an error is caught an the user expects a response, an appropriate reply must be sent to notify the user that a problem occured.

**Rule**: Awaited APIs and any piece of code that can throw errors must be handled inside a try-catch block.

**Recommendation**: Inconsequential failures that are expected to throw errors may be let to throw a silent error.

```ts
try {
	await message.delete();
} catch {/*do nothing*/}
```

API calls such as deleting a message sometimes fail to execute, but if `message.delete()` is done as a cleanup and it doesn't create functional problems, it may be let to throw silently. 

---

## 7. Validation

- interactionCreate validates top-level ChatCommand, group and category wide related data, individual commands must validate their specific input.
- When operating within a system, check if validator methods are already implemented for the system
- undefined should be used for missing optional parameters while null should represent absence of entity. For example `fetchGuildMember(guild, id)` returns null if there is no member in the guild with that id.

**Rule**: Building menus and functionality through embed messages with button or select menu components must thoroughly validate and update data at every click as users can abuse opening multiple menus within the same session or for Discord objects to become invalid while a menu that depends on them is running.

---

## 8. Interaction Implementation

### 8.1 Slash commands

The entire documentation can be found at section **3.3 Commands**.

Slash commands are implemented respecting the ChatCommand pattern.

### 8.2 Message components

Buttons and all select menus fall under this category.

**Rule**: Message component interactions must be handled inside a message collector and ignored by interactionCreate.

**Rule** Persistent message collectors are implemented by storing guild, channel and message IDs and using them to fetch the Discord objects between sessions to attach the message collector again in `utility_modules/attach_collectors.ts`.

**Rule**: Avoid attaching a collector through the raw API, use the `message_collector()` to instantiate one.

Pattern snippet of using message collector

```ts
const reply = await interaction.fetchReply(); // must be called after the interaction replies with components attached to the message

// can be stored to be stopped before timeout if needed
const collector = await message_collector<ComponentType.Buttom>(
	reply,
	{
		componentType: ComponentType.Button.
		filter: ...,
		time: 600_000 // 10 minutes in milliseconds
	},
	async (buttonInteraction) => {
		// executing stuff
		(await collector).stop(); // stoping the collector realy
	},
	async () => { /* handle end event or on stop function being called*/}
)
```

**Recommendation**: Do NOT send the message as ephemeral if you want the message to be deleted or edited inside the collector.

**Guideline**: The name of the component interaction should be camel case component name + suffix "Interaction". Example: buttonInteraction, selectInteraction, userSelectInteraction, etc.

**Guideline**: Components should have their custom Ids set to the following format: `<functionality-name>-<component-name>`. For example: accept-button, select-user-menu.

**Guideline**: The only separator should be the dash "-".

**Rule:** When handling messages with multiple components of the same type, most commonly buttons, each component's functionality should be handled similarly to subcommands.

If a message contains multiple buttons, branch the functionality for each button using a `switch`.

If the logic for a button is too complex to keep directly inside the `switch`, use the same convention as commands and subcommands: build the required system separately and call its top-level function from the collector.

```ts
// the execute method for a button collector
// with multiple buttons
async (buttonInteraction) => {
	// running general checks
	const buttonId = buttonInteraction.customId;
	switch(buttonId) {
		case "accept-button": {
			...
			break;
		}
		case "refuse-button": {
			...
			break;
		}
	}
}
```

### 8.3 Modals

**Rule**: Calling `interaction.reply()` or `interaction.deferReply()` before showing a modal is forbidden as it throws an exception.

**Rule**: Modals must be built using `modal_builder()` method.

A custom modal is built with `ModalBuilder` object exposed as `built_modal` and its custom id exposed directly as `id`.

**Rule**: Handling and executing tasks after modal submission is awaited must be done through the `execute_modal()` method which defines a similar pattern as `message_collector()`.

execute_modal standardizes proper modal filter checks and wraps everything in a try-catch block with a default error handling if no custom`onError()` function is provided.

The following code is an example of how modals are built and handled in this project.

```ts
const options: RestOrArray<APISelectMenuOption> = [
    {
        label: "one",
        value: "1"
    },
    {
	    label: "two",
	    value: "2"
    },
    {
        label: "three",
        value: "3"
    }
];

const select = new StringSelectMenuBuilder()
    .setCustomId("test-menu")
    .setMinValues(1)
    .setMaxValues(3)
    .setRequired(true)
    .addOptions(options);

const label = new LabelBuilder()
    .setLabel("select")
    .setStringSelectMenuComponent(select);

const modal = modal_builder([label], "test modal");

await execute_modal(
    interaction,
    modal,
    {
        time: 300_000
    },
    async (submit) => {
        await submit
	        .reply(`${submit.fields.getStringSelectValues("test").join(", ")}`);
        }
);
```

This block of code builds a select menu, adds it to a label object, builds a modal using the label (must be sent as an array) and then handles the submitted input by typing it in the chat.

### 8.4 Responses

When to use:

```ts
interaction.reply();
interaction.deferReply();
interaction.editReply();
```

- reply should be used directly when the execution is expected to finish before the 3 second window.
- deferReply should be used when the interaction can be expected to have latency over 3 seconds. If database rows need to be fetched and those rows need to be then fetched as Discord objects by awaiting all those requests, it's a good indicator that the reply needs to be defered first.
- If the reply needs to change states as is the case when deferReply is used, then editReply must be called to update the response,


---

## 9. Reuse and Abstraction

It must be insisted on the importance of checking helper source files before implementing your own abstractions.

### 9.1 Conventional abstractions

- Instead of fetching a Discord object (such as a GuildMember) by calling the API directly or implementing your own method, try to look for a method that starts with `fetch...` or `fetchGuild...` and the name of what you're trying to fetch.
- Also, if a Discord object is defined in database to be fetched when needed, check again for existing implementations of `fetch` functions. For example, if fetching a logging channel is desired, instead of using the repository to query the database for a channel and then to validate the returned value and then to call `fetchGuildChannel` on that ID if it exists and then to validate the return of this method as well, the method `fetchLogsChannel` could be used instead as it implements the entire pattern safely
- Message collectors must use `message_collector` pattern
- Modals must use `modal_builder` and `execute_modal` pattern

Overall, as a rule of thumb, if everything you wanted is already there, just call the method instead.


### Define your own abstraction when:

- the same behavior occurs in multiple places
- implementations must remain consistent
- the abstraction removes meaningful complexity

### Do not extract merely because:

- two pieces of code look similar
- a function would save two lines
- you anticipate a future use case that does not exist yet

---

## 10. Naming of Project Concepts

Project concepts should be named according to their architectural responsibility. A name should communicate what a component represents or does rather than merely describing its implementation.

### 10.1 System

A **System** is a feature-specific collection of components that provides functionality independently of the top-level environment from which it is called.

Use `System` when functionality represents a complete feature or functional subsystem, especially when it is used by multiple entry points such as commands, button interactions or events.

Examples:

```text
PremiumSystem
TicketSystem
AutoVoiceSystem
```

Do not use `System` for a small reusable helper or a generic abstraction. General-purpose reusable abstractions belong under `Systems/components/` or `utility_modules/` depending on their scope.

### 10.2 Repository

A **Repository** is the database access layer for a table or system of tables.

Repository names must identify the table or group of tables they operate on and use the `Repository` suffix for the class and `Repo` suffix for the exported singleton.

```ts
class TicketRepository { ... }

const TicketRepo = new TicketRepository();
```

A repository should not be named after a higher-level feature if its responsibility is specifically database access.

### 10.3 Model

A **Model** represents the database structure declared by the project and is responsible for creating its corresponding database table or tables.

Model names should correspond to the table or system of tables they represent.

```text
Models/ticketsystem.ts
Repositories/ticketsystem.ts
```

The Model and Repository should therefore use the same base concept when they represent the same database structure.

### 10.4 Handler

A **Handler** is responsible for loading, registering, dispatching or coordinating execution of a category of project components.

Use `Handler` for infrastructure whose primary responsibility is managing other components rather than implementing the feature logic itself.

Examples:

```text
cronHandler
onReadyTasksHandler
```

A feature implementation should not be called a Handler merely because it contains functions that execute functionality.

### 10.5 Builder

A **Builder** is an abstraction whose primary purpose is constructing another object or standardized structure.

Use `Builder` when the component provides a reusable construction pattern rather than performing the resulting object's main functionality.

Examples:

```
lfg_builder
modal_builder
role_builder
```

Do not use `Builder` for a general-purpose utility that merely happens to return an object.

### 10.6 Provider

A **Provider** represents an abstraction responsible for obtaining or supplying a resource or dependency.

Use `Provider` when the primary responsibility is access to or provision of a resource rather than manipulation of that resource.

For example, a provider may encapsulate how a dependency or Discord resource is obtained while leaving the feature-specific logic to the caller.

### 10.7 Utility

A **Utility** is a reusable abstraction whose functionality is sufficiently general to be used across unrelated features.

Utilities should not represent feature-specific functionality. Feature-specific abstractions belong in a System.

Examples include:

```text
utility_methods
discord_helpers
error_logger
```

Use a more specific name when the abstraction has a clearly defined architectural role such as `Repository`.

### 10.8 Interface

An **Interface** defines the structure or contract of an object used for typing and type checking.

Use `Interface` conceptually for contracts rather than implementations. Interfaces that are specific to a single system should generally remain local to that system; interfaces shared across systems belong under `Interfaces/`.

### 10.9 Command

A **Command** represents a Discord Slash Command and its execution entry point.

Command names should correspond to the command exposed through `SlashCommandBuilder` and, by project convention, the source file must use the same name.

A command should describe the user-facing operation rather than the implementation mechanism behind it.

### 10.10 Event

An **Event** represents a Discord event callback.

Event source files should use the corresponding Discord.js event name. Event files are entry points and should delegate substantial functionality to systems or components rather than becoming feature implementations themselves.

### 10.11 Collector

A **Collector** represents the mechanism responsible for receiving and handling interactions with message components.

Collectors should be understood as interaction infrastructure, not as feature-specific systems. The collector handles receiving and dispatching the interaction while the underlying functionality should remain in the appropriate command, system or component.

### 10.12 General Naming Principle

When choosing a project concept name, prefer the name that describes its **architectural responsibility**.

For example:

```text
Database access       ==> Repository
Object construction   ==> Builder
Feature functionality ==> System
Resource acquisition  ==> Provider
Generic reusable code ==> Utility
Event entry point     ==> Event
Command entry point   ==> Command
Component dispatch    ==> Collector
Component management  ==> Handler
```


Do not use these names merely because they sound appropriate. The component should actually conform to the responsibility represented by the term. If a component performs multiple unrelated responsibilities, reconsider its structure before choosing a broader or less precise name.

---

## 11. Performance Practices


- Avoid repeated Discord API requests.
- Use the existing cache abstraction.
- Avoid repeated database queries inside loops.
- Prefer bulk queries where appropriate.
- Do not create persistent collectors without a cleanup strategy.

---

## 12. Exceptions

These conventions are defaults, not substitutes for engineering judgment.

A convention may be bypassed when:

- the abstraction cannot support the required behavior;
- it introduces disproportionate complexity;
- performance requires a different implementation;
- an external API imposes a constraint.

When bypassing a Rule, document the reason in code or in a decision record under `docs/decisions/` when the decision has architectural significance.