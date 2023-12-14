// The first signs of "it works!" are provided by the ready event.
// It is also used to initialize some features from the first moments, like auto-updating the presence

const { Client, ActivityType } = require("discord.js");
const fs = require("fs");

function randNum(maxNumber) {
    // a basic random function depending on a max number
    return Math.floor(Math.random() * maxNumber);
}

// the function that handles bot's presence
async function statusSetter (client, presence, actList) {
    let selectNum = randNum(4); // selecting a random number between 0 to 3
    let decide = actList[randNum(selectNum)]; // selecting the active presence
    // setting
  await client.user.setPresence({
        activities: [
            {
                name: presence[decide][randNum(presence[decide].length)],
                type: ActivityType[decide],
            },
        ],
        status: "online",
    });
}

module.exports = {
    name: "ready",
    once: true,
    async execute(client) {
        // just a little greeting in our console
        let currentDate = new Date();
        console.log(
            `${
                client.user.username
            } is functional! - ${currentDate.getDate()}.${currentDate.getMonth()}.${currentDate.getFullYear()} | [${currentDate.getHours()}:${currentDate.getMinutes()}:${currentDate.getSeconds()}]`
        );

        const readFile = async (filePath, encoding) => {
            try {
                const data = fs.readFileSync(filePath, encoding);
                return JSON.parse(data);
            } catch (error) {
                console.error(error);
            }
        };
        let presenceConfig = await readFile("./objects/presence-config.json","utf-8");
        const activityTypes = ["Playing", "Listening", "Watching"];
        const presetFilePath = presenceConfig.type === 0 ? 
          './objects/default-presence-presets.json' : './objects/custom-presence-presets.json';
        const presencePresetsObject = await readFile(presetFilePath, 'utf-8');
        let autoUpdateInterval; // this variable will act as the interval ID of auto-update presence
        if(presenceConfig.status == "enable")
          if(presenceConfig.delay) {
              autoUpdateInterval = setInterval(async () =>{
                
                const presenceConfig = await readFile("./objects/presence-config.json","utf-8"); // updating the object to stop the interval
                // if a configuration change is done to the presence status
                if(presenceConfig.status == "disable")
                  clearInterval(autoUpdateInterval);
                await statusSetter(client, presencePresetsObject, activityTypes);

            }, presenceConfig.delay * 1000); // delay in milliseconds x1000 is converted to seconds
          }
          else await statusSetter(client, presenceConfig, activityTypes);

    },
};
