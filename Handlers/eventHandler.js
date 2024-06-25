
// Define a function 'loadEvents' that takes a 'client' parameter
function loadEvents(client)
{
    // Import the 'ascii-table' library to create a table for displaying event loading status
    const ascii = require('ascii-table');
    const table = new ascii().setHeading('Events', 'Status');
    const fs = require('fs');
    // Read the contents of the 'Events' directory synchronously
    const folders = fs.readdirSync('./Events');
    // Iterate through each folder in the 'Events' directory
    for(const folder of folders)
    {
        
         
        const files = fs.readdirSync(`./Events/${folder}`).filter((file) => file.endsWith('.js'));

         
         // Iterate through each file in the current folder
        for(const file of files)
        {
            // Require the current event file
            const event = require(`../Events/${folder}/${file}`);
            // Check if the event has a 'rest' property
            if(event.rest)
            {
                if(event.once)
                // Register the event as a one-time event using client.rest.once
                    client.rest.once(event.name, (...args) =>
                    event.execute(...args, client)
                );
                else
                    client.rest.on(event.name, (...args) =>
                    event.execute(...args, client)
                );
            }
            else
            {
                if(event.once)
                    client.once(event.name, (...args) => event.execute(...args, client));
                else
                // Register the event using client.on for multiple executions
                    client.on(event.name, (...args) => event.execute(...args, client));
            }
            table.addRow(file, "loaded");
            continue;
        }
    }
    return console.log(table.toString(), "\nLoaded events");
}

module.exports = {loadEvents};