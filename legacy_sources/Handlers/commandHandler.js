
function loadCommands(client)
{
    const ascii = require('ascii-table');
    const table = new ascii().setHeading('Commands', 'Status');
    const fs = require('fs');
    const folders = fs.readdirSync('./Commands');

    // Initialize an empty array to store command properties
    let commandsArray = [];

    // Iterate through each folder in the 'folders' array
    for(const folder of folders)
    {
        // Get the list of js files in the current
        const files = fs.readdirSync(`./Commands/${folder}`).filter((file) => file.endsWith('.js'));

        // Iterate through each file in the current folder
        for(const file of files)
        {
            // Require the current command file
            const commandF = require(`../Commands/${folder}/${file}`);

            // Create an object 'proprieties' that includes the 'folder' and properties from 'commandF'
            const proprieties = {folder, ...commandF};

            // Set the command in the client's commands collection using the command name as the key
            client.commands.set(commandF.data.name, proprieties);
            commandsArray.push(commandF.data.toJSON());
            // Add a row to the table indicating that the command file has been loaded
            table.addRow(file, "loaded");
            continue;
        }
    }
    client.application.commands.set(commandsArray);

    //displays the command table
    return console.log(table.toString(), "\nLoaded commands");
}

module.exports = {loadCommands};