# LFG System Design

This document defines the behavior, configuration, and runtime flow of the Discord LFG (Looking For Group) system.

---

## 1. System Overview

The LFG system allows guilds to configure multiple games, channels, and gamemodes, and manage player LFG posts. The configuration and runtime data are fully stored in the database to ensure consistency and traceability.

---

## 2. Configurations

### 2.1 Game Configurations

- A guild can have multiple games, each represented by a unique name.
- Each guild-game combination can have only **one configuration**.
- A game configuration includes:
  - A **category channel** that contains all related LFG channels.
  - A **manager channel** with a pinned message for managing LFG posts.
  - A **manager message** with buttons to create LFG posts.

### 2.2 Channels

- Games can have **one or more channels**, representing text-based recruitment spaces (in the form of Discord text channels).
- Channels are unique within a guild-game combination.
- Each channel may be assigned **multiple gamemodes**, but the same gamemode cannot be assigned twice to the same channel.
- Channel IDs correspond to Discord text channels created during setup.

### 2.3 Gamemodes

- Gamemodes are textual identifiers for the type of activity or match.
- Each game can have multiple gamemodes, shared among channels.
- Gamemodes are assigned to channels via a many-to-many relationship.

### 2.4 Roles

- Roles include **in-game roles** (role roles) and **rank roles**, represented as Discord role snowflakes.
- Each role must be **unique per guild**.
- Roles are assigned to games and may be referenced in LFG posts for player selection.
- Role types: `role` or `rank`.

---

## 3. LFG Creation Workflow

1. **Configuration Setup**
   - A server admin triggers a setup command.
   - An interactive Discord menu guides the creation of:
     - Game configuration
     - Channels
     - Gamemodes
     - Roles
   - The system registers all data in the database and optionally creates the necessary Discord channels.

2. **Posting an LFG**
   - Users interact with the **manager message buttons**.
   - Each button corresponds to a specific functionality.
   - One with an indicative label such as "LFG" will open a select menu to let the member choose which LFG channel to use
   - When a LFG channel is selected:
     - A **modal interface** opens.
     - The system knows which game and channel to post the LFG based on the manager used and the LFG channel selected.
     - Users fill in:
       - The gamemode they wish to post the LFG message for
       - Optionally select the roles and ranks they desire to find
       - The number of players they are looking for
       - Additional details if they wish to add anything else
   - Once submitted:
     - A formatted **embed message** is posted in the appropriate channel.
     - The post and all metadata (roles, gamemodes, owner, slots, description) are stored in the database.
     - The message is linked to the member's snowflake ID who created it.
   - Posting through a raw message that matches the necessary regex patterns and through a slash command is proposed as well.

3. **Post Management**
   - Each post is associated with:
     - The game configuration
     - The channel where it was posted
     - Selected gamemodes and roles
     - Creator’s Discord ID
   - Posts can be marked as **closed** when the member that generated the message leaves the voice channel.

---

## 4. System Rules and Constraints

- **Unique constraints**:
  - Only one configuration per game per guild.
  - Channel names unique within a game configuration.
  - Gamemodes unique per game; a channel cannot have the same gamemode twice.
  - Roles must be unique per guild.
  - Posts are unique.
- **Relationships**:
  - Channels belong to games.
  - Gamemodes are linked to channels.
  - Roles are linked to games and referenced in posts.
  - Posts are linked to channels, gamemodes, roles, and the creator (owner/poster).
- **Cascade behavior**:
  - Deleting a game configuration removes its channels, gamemodes, roles, and posts.
  - Deleting a channel removes its gamemode assignments.
  - Deleting a post removes role and gamemode associations.

---

## 5. Discord Representation

- **Category Channel**: Represents the game LFG system.
- **Text Channels**: Represent LFG channels under the category.
- **Manager Channel**: Text Channel that Contains the **manager message** with buttons.
- **Manager Message**:
  - One message per game configuration.
  - Buttons correspond to LFG functionalities such as posting and displaying available posts.
  - Clicking the LFG button opens a select menu, after choosing the channel to post in, the LFG post interface opens.
- **LFG Post**:
  - Embed message formatted with user input.
  - References selected gamemodes, roles, and player count.
  - Stored and tracked in the database for moderation and analytics.

---

## 6. Example

- **Member** joins a Voice Channel
- **Member** goes to #lfg-league-of-legends, the Manager Channel under the game category League of Legends
- **Member** clicks the LFG button
- **Manager** opens a select menu with all the Text Channels registered for the game as LFG channels
- **Member** selects #eune
- **Manager** opens a modal interface where the Member has to select the gamemode, has to insert the number of players they are looking for and can optionally select the ranks and the roles they are looking for their premades, and can optionally insert additional text
- **Manager** takes all the input into account, stores the data and embeds a message with the informations given.
- **LFG Post** is being sent in the corresponding LFG channel
