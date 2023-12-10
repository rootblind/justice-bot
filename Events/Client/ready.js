const { Client, ActivityType } = require("discord.js");
const fs = require("fs");

function randNum(maxNumber) { // a basic random function depending on a max number
  return Math.floor(Math.random() * maxNumber);
}

// the function that handles bot's presence
function statusSetter(client, presence, actList) {
    let selectNum = randNum(4); // selecting a random number between 0 to 3
    let decide = actList[randNum(selectNum)]; // selecting the active presence

    // setting
    client.user.setPresence({
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
    
    // here are the objects (JSONs) used to select presence
    let botAuto; // used for interval // in case the delay is not zero, meaning that the presence is set to autoupdate
    let rawConfig = fs.readFileSync("./objects/presence-config.json");
    let presenceConfig = JSON.parse(rawConfig);
    //the bot might need to be restarted in order to read the new config
    let actList = ["Playing", "Listening", "Watching"];
    let rawData = fs.readFileSync("./objects/presence-presets.json");
    let presence = JSON.parse(rawData);
    if(presenceConfig["status"] == "enable") // if the status is disable, the bot won't be set with any presence
        if(presenceConfig["delay"])
        botAuto = setInterval(() => {
            statusSetter(client, presence, actList);
        }, presenceConfig["delay"] * 1000); // setInterval takes delay in milliseconds.
        else
            statusSetter(client, presence, actList);


  },
};
