
var socketId;
//var dataFromRead = "";
var serverConnect = "chat.freenode.com";
var ircPort = 6667;
var serverName;
var channelName ="#realtestchannel";
var timeOfLastChanMsg = new Date();
timeOfLastChanMsg.setTime(1); //initialize the time to 1. 
var silentTimeMin=.1;
var botName="GoodbyeBot"

//Bot Sayings
var goodVibes = ["Goodbye.", "Goodbye, $user"];

var userName;

//initiates an object
function IrcCommand() {
  this.prefix = "";
  this.command = "";
  this.username = "";
  this.args = [];
  this.msgSender=""; //if command is PRIVMSG, we'll populate this 
}

function main()
{
    chrome.storage.local.get('userName', function(results)
  {
    console.log("We're in chrome.storage.local.get");
    userName = results.userName || botName;

    chrome.socket.create('tcp', {}, function onSocketCreate(createInfo)
    {
      socketId = createInfo.socketId;
      chrome.socket.connect(socketId, serverConnect, ircPort, onConnected);
    }); // end socket.create
  }); // end get userName from storage
  
  var inputElement = document.getElementById('typing');
  inputElement.addEventListener('keydown', function (event)
  {
    // if the user pushed the enter key while typing a message (13 is enter):
    if (event.keyCode === 13)
    {
      var message = inputElement.value;
      inputElement.value = "";
      write("PRIVMSG " + channelName + " :" + message);
    }
  })
}//end main

function onConnected()
{
  console.log("We're in onConnected");
  document.getElementById('connectionStatus').textContent = "connected!";
  readForever();
  console.log(socketId);
  read();
  write('PASS none');
  write('NICK ' + userName);
  write('USER USER 0 * :Real Name', function()
  {
    //wait for a sign that we're registered before joining.
    //Welcome to the Internet Relay Network -RPL_WELCOME via IRC RFCs
    //socket.listen is not  an option for client side connections. let's try reading until we get what we want
    var welcomeMsg="";
    var dateRead = new Date();
  })//end write
} // end onConnected

function onDisconnected()
{
  document.getElementById('connectionStatus').textContent = "disconnected :(";
  chrome.socket.disconnect(socketId);
} // end onDisconnected
//writes a message to the server. Argument is a string. The function automatically adds \r\n to the end of the message
function write(s, f) 
{
  s+="\r\n";
  console.log(s);

  //Make sure we're not spamming the channel. If this is going to the channel, check to see how often we're sending. 

  if (s.search("PRIVMSG "+channelName)>-1)
   {
    //Spam Protection. We don't want to spam the channel. 
    var dateObj = new Date();
    if (dateObj.getTime()-timeOfLastChanMsg.getTime()>silentTimeMin*60000)
    {
      displayLineToScreen("[sent] " + s);
      chrome.socket.write(socketId, str2ab(s), function(good) {console.log('write was ', good); if (f) f();});
      timeOfLastChanMsg.setTime(dateObj.getTime());
    }
    else
    {
      displayLineToScreen("[Spam?] You don't get to write because you messaged the channel already. " + dateObj.getTime());
      console.log("You don't get to write because you messaged the channel already. dateObj.getTime: ")
      console.log(dateObj.getTime());
      console.log("Time of timeOfLastChanMsg")
      console.log(timeOfLastChanMsg.getTime());
      console.log(dateObj.getTime()-timeOfLastChanMsg.getTime())
      console.log(dateObj.getTime()-timeOfLastChanMsg.getTime()<silentTimeMin*60000)
    }
  }
  else
  {
    displayLineToScreen("[sent] " + s);
    chrome.socket.write(socketId, str2ab(s), function(good) {console.log('write was ', good); if (f) f();});
  }
}//end write

//Takes a string and turns it into an Array Buffer for pushing messages through sockets
function str2ab(str)
{
  var buf = new ArrayBuffer(str.length*1); // 1 byte for each char
  var bufView = new Uint8Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++)
  {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}
//takes array buffer and turns it into string so the user can read it.
function ab2str(buf)
{
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function read()
{
  chrome.socket.read(socketId, null, function(readInfo) {
    if (readInfo.resultCode > 0) {
      var dateRead = new Date();
      console.log(dateRead + ab2str(readInfo.data));
      //dataFromRead+=dateRead.getTime()+ab2str(readInfo.data)+"/n";
    }
  });

}//end read
//function readForever - Reads messages from server
//                        Also does the first processing of messages.
function readForever(readInfo)
{
  if(readInfo!==undefined && readInfo.resultCode <= 0)
  {
    // we've been disconnected, dang.
    onDisconnected();
    console.log(readInfo.resultCode);
    return;
  }
  if (readInfo !== undefined)
  {
    var dateRead = new Date();
    var serverMsg = ab2str(readInfo.data);
    console.log(dateRead + serverMsg);
    //if trigger matches data, do stuff here.

    var serverLines = [];
    var serverMessages = [];
    serverLines = serverMsg.split("\n");

    //Split the server messages into single lines.
    for(var i = 0; i < serverLines.length; i++)
    {
      //If the line wasn't empty, save the message.
      var msg = crackMessage(serverLines[i]);
      if(msg !== undefined)
      {
        serverMessages.push(msg);
      }
    }

    var messageLines = serverMsg.trim().replace(/\r/g, '').split('\n');
    for (var i = 0; i < messageLines.length; i++)
    {
      displayLineToScreen(messageLines[i]);
    }

    //get server name
    //the server sends :servername. I start the substring at 1 instead of 0 to take this into account.
    if(!serverName)
    {
      serverName = serverMsg.substring(1,serverMsg.search(' ')); //IRC server msg is of the for ":servername msg", so search for first instance of space as the end of the servername.
    }

    for(var i = 0; i < serverMessages.length; ++i)
    {
      var m = serverMessages[i];
      console.log(m.command, m);
      switch(m.command)
      {
        //Welcome message!
        case "001":
          write('JOIN ' + channelName);
          break;
        case "PING":
          write("PONG :"+serverName);
          displayLineToScreen('[SERVER PONG]');
          break;
        case "PRIVMSG":
          handlePrivmsg(m);
          console.log(m.msgSender);
          break;
        default:
          //All this spew is a bit annoying.
          //console.log("WARN: Unhandled message: ", m);
          break;
      }
    }

    //if MSG, respond

    //if channel message =5 and last date spoken is >5 minutes ago, say something
    //if msg !stfu x, be silent for x minutes.
  }

  chrome.socket.read(socketId, null, readForever); //On Peter's advice changing this to just call itself
}//end readForever

function setUserName(newUserName, optionalCallback)
{
  chrome.storage.local.set({userName: newUserName}, optionalCallback);
} // end setUserName

//Converts a single message from an IRC server into an IrcCommand object.
function crackMessage(serverLine) {
  if(serverLine.length == 0)
  {
    return undefined;
  }
  var r = new IrcCommand();
  var parts = serverLine.split(" ");
  var offset = 0;

  //If our message had a prefix, store it.
  if(parts[0][0] == ":" )
  {
    r.prefix = parts[0];
    offset = 1;
  }
  r.command = parts[0+offset];
  r.username = parts[1+offset];
  r.args = parts.slice(2+offset);
  return r;
}
//This function processes PRIVMSG from the IRC server. 
//              It handles channel messages and direct messages.
function handlePrivmsg(message) {
  //This is a message to the channel:
  if(message.username === channelName)
  {
    for(var i = 0; i < message.args.length; ++i)
    {
      var arg = message.args[i];
      //Slice off the colon from the first arg.
      //FIXME: We should do this fixup elsewhere.
      if(i === 0)
      {
        arg = arg.substring(1);
      }
      //TODO: OptimistBot should say random things every minute
      //      OptimistBot should mention user's name when another user mentions him. 
      if(arg.search(/hello/i) != -1) 
      {
        //find out who sent it:
        var msgPrefix = message.prefix;
        //console.log(message.prefix+"Prefix <---");        console.log(message.command);        console.log(message.args);
        var msgSenderEnd=msgPrefix.search('!'); //IRC protocol is ":username!user@server CMD username msg". Hence, search for !~
      //  console.log("msgSenderEnd: "+msgSenderEnd);
        var msgSender = msgPrefix.substring(1,msgSenderEnd);
      //  console.log(msgSender);
        message.msgSender=msgSender;
      //  console.log(message.msgSender+" that was the message.msgSender");
        //grab a random thing to say
        var strRandomGoodVibe = getRandomGoodVibe(msgSender); 
        write("PRIVMSG " + channelName + " :"+strRandomGoodVibe);
        //leave channel.
        write("PART "+ channelName);
        //need to join again in 10 seconds.
        setTimeout(function(){write('JOIN ' + channelName);},10000);
      }
    }
  }
  //If not, it must be a message to me.
  else
  {
    var messagingUser = message.prefix.slice(1, message.prefix.search("!"));
    write("PRIVMSG " + messagingUser + " :Goodbye");
  }
}//end handlePrivMsg()

//Function selects a Random Good Vibe and prepares it for writing. 
//Function argument is user who sent message. 
function getRandomGoodVibe(user){

        //grab a random thing to say
        var max = (goodVibes.length>0) ? (goodVibes.length-1) : (0); //prevent goodVibes.length from being -1
        var min = 0;
        var indexGoodVibe=Math.floor(Math.random()*(max-min+1)-min);
        //prepare the statement for sending
        var strMsg = goodVibes[indexGoodVibe]
        //replace $user with user var
        if (strMsg.search("\\$user")!==-1)
        {
          strMsg=strMsg.replace("\$user",user,"gi")
        }
        return strMsg;
}
//Rough UI to see and write channel chats
function displayLineToScreen(text)
{
  var p = document.createElement('pre');
  p.textContent = text;
  var container = document.getElementById('recent-chat-display');
  container.appendChild(p);
  while (container.childNodes.length > 15)
  {
    container.childNodes[0].remove();
  }
}
if(window.chrome.socket)
{
  debugger;
  main();

}