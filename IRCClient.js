//create IRCClient class/object
function IRCClient(){
  this.socketId;
  this.serverConnect;
  this.ircPort;
  this.serverName;
  this.userName;
  this.connected=false;
  this.channelName="";
  this.silentTimeMin = .1;
  this.goodVibes = [];
  this.timeOfLastChanMsg = new Date();
  this.timeOfLastChanMsg.setTime(1); //initialize the time to 1.
  //need join channel (channel)
  //need connect (server, username,pw)
  //need onmessage
};
IRCClient.prototype.connectToServer=function(Port,server)
{
	serverConnect=server;
	ircPort=Port;
	var self = this;
	chrome.socket.create('tcp', {}, function onSocketCreate(createInfo)
    {
      socketId = createInfo.socketId;
      chrome.socket.connect(socketId, serverConnect, ircPort, self.onConnected.bind(self));
    }); // end socket.create
};
//initiates an object for command parser
IRCClient.prototype.IrcCommandParsed= function() {
  this.prefix = "";
  this.command = "";
  this.username = "";
  this.args = [];
  this.msgSender=""; //if command is PRIVMSG, we'll populate this 
};

IRCClient.prototype.setUserName= function(newUserName, optionalCallback)
{
  userName=newUserName; //shouldn't this only be if its not taken?
  chrome.storage.local.set({userName: newUserName}, optionalCallback);
} // end setUserName

IRCClient.prototype.onConnected= function()
{
  console.log("We're in onConnected");
  this.connected=true;
  document.getElementById('connectionStatus').textContent = "connected!";
  this.readForever();
  console.log("The socketId is "+socketId);
  //should this go in another function?
  if(this.connected){
  this.write('PASS none');
  this.write('NICK ' + userName);
  this.write('USER USER 0 * :Real Name', function(){
  	console.log("wrote pass, nick, and user user 0 *")
  })//end write
  }//end if connected
} // end onConnected
IRCClient.prototype.onDisconnected=function()
{
  this.connected=false;
  document.getElementById('connectionStatus').textContent = "disconnected :(";
  chrome.socket.disconnect(socketId);
} // end onDisconnected
IRCClient.prototype.crackMessage=function(serverLine) {
  
  if(serverLine.length == 0)
  {
    return undefined;
  }
  var r = new this.IrcCommandParsed();
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
//takes array buffer and turns it into string so the user can read it.
IRCClient.prototype.ab2str= function(buf)
{
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}
//Takes a string and turns it into an Array Buffer for pushing messages through sockets
IRCClient.prototype.str2ab = function (str)
{
  var buf = new ArrayBuffer(str.length*1); // 1 byte for each char
  var bufView = new Uint8Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++)
  {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}
IRCClient.prototype.processReadInfo= function(readInfo)
{
	var self = this;
	var dateRead = new Date();
    var serverMsg = self.ab2str(readInfo.data);
    console.log(dateRead + serverMsg);
    
    //if trigger matches data, do stuff here.

    var serverLines = [];
    var serverMessages = [];
    serverLines = serverMsg.split("\n");

    //Split the server messages into single lines.
    for(var i = 0; i < serverLines.length; i++)
    {
      //If the line wasn't empty, save the message.
      var msg = self.crackMessage(serverLines[i]);
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
    if(!self.serverName)
    {
      self.serverName = serverMsg.substring(1,serverMsg.search(' ')); //IRC server msg is of the for ":servername msg", so search for first instance of space as the end of the servername.
    }

    for(var i = 0; i < serverMessages.length; ++i) {
      var m = serverMessages[i];
      console.log(m.command, m);
      switch(m.command) {
        //Welcome message!
        case "001":
          console.log("Ready to join channel");
          //make a join function
          if(this.joinWhenConnected)
          	this.joinWhenConnected();
          break;
        case "PING":
          //write a pong function
          if(this.pingResp)
          	this.pingResp();
          break;
        case "PRIVMSG":
          this.handlePrivmsg(m); 
          console.log(m.msgSender);
          break;
        default:
          //All this spew is a bit annoying.
          //console.log("WARN: Unhandled message: ", m);
          break;
      }//end switch
  }//end for
}//end function processReadInfo
//IRCCLient parses the message, then calls the user generated function onMessage if it exists. 
IRCClient.prototype.handlePrivmsg = function(message) {
  //This is a message to the channel:

    for(var i = 0; i < message.args.length; ++i)
    {
      var arg = message.args[i];
      //Slice off the colon from the first arg.
      //FIXME: We should do this fixup elsewhere.
      if(i === 0)
      {
        arg = arg.substring(1);
      }
      //find out who sent it:
        var msgPrefix = message.prefix;
        //console.log(message.prefix+"Prefix <---");        console.log(message.command);        console.log(message.args);
        var msgSenderEnd=msgPrefix.search('!'); //IRC protocol is ":username!user@server CMD username msg". Hence, search for !~
      //  console.log("msgSenderEnd: "+msgSenderEnd);
        var msgSender = msgPrefix.substring(1,msgSenderEnd);
      //  console.log(msgSender);
        message.msgSender=msgSender;
      //commence further parsing. hande over to user.
      if (this.onMessage)
        {
        	this.onMessage(message, arg);
        }
  	}//end for	
 
}//end handlePrivMsg()
IRCClient.prototype.readForever=function (readInfo){
	var self = this;
  if(readInfo!==undefined && readInfo.resultCode <= 0){
    // we've been disconnected, dang.
    self.onDisconnected();
    console.log(readInfo.resultCode);
    return;
  }
  if (readInfo !== undefined) {
  	//call new function to process message
  	this.processReadInfo(readInfo);
  }
  //call read forever again so the server alerts us when something interesting happens
  chrome.socket.read(socketId, null, this.readForever.bind(this)); 
}//end readForever

//writes a message to the server. Argument is a string. The function automatically adds \r\n to the end of the message
IRCClient.prototype.write= function(s, f) {
  s+="\r\n";
  console.log(s);

  //Make sure we're not spamming the channel. If this is going to the channel, check to see how often we're sending. 

  if (s.search("PRIVMSG "+this.channelName)>-1)
   {
    //Spam Protection. We don't want to spam the channel. 
    var dateObj = new Date();
    if (dateObj.getTime()-this.timeOfLastChanMsg.getTime()>this.silentTimeMin*60000)
    {
      displayLineToScreen("[sent] " + s);
      chrome.socket.write(socketId, this.str2ab(s), function(good) {console.log('write was ', good); if (f) f();});
      this.timeOfLastChanMsg.setTime(dateObj.getTime());
    }
    else
    {
      displayLineToScreen("[Spam?] You don't get to write because you messaged the channel already. " + dateObj.getTime());
      console.log("You don't get to write because you messaged the channel already. dateObj.getTime: ")
      console.log(dateObj.getTime());
      console.log("Time of timeOfLastChanMsg")
      console.log(this.timeOfLastChanMsg.getTime());
      console.log(dateObj.getTime()-this.timeOfLastChanMsg.getTime())
      console.log(dateObj.getTime()-this.timeOfLastChanMsg.getTime()<this.silentTimeMin*60000)
    }
  }
  else
  {
    displayLineToScreen("[sent] " + s);
    chrome.socket.write(socketId, this.str2ab(s), function(good) {console.log('write was ', good); if (f) f();});
  }
}//end write

//set silentTimeMin.
// SilentTimeMin is checked against each time the bot writes to the channel. This is to prevent inadverdant spamming.
// default set to .1 minutes
IRCClient.prototype.setSilentTimeMin = function(min)
{
	this.silentTimeMin = min;
}
//PONG a server
IRCClient.prototype.pong=function(){
	this.write("PONG :"+this.serverName);
    displayLineToScreen('[SERVER PONG]');
}

//join a channel if you have a valid connection
IRCClient.prototype.join = function(channel){
	if(this.connected){
		this.write('JOIN ' + channel);
		this.channelName=channel;
	}
	else
		console.log("Not connected");
}
//Rough UI to see and write channel chats
function displayLineToScreen(text){
  var p = document.createElement('pre');
  p.textContent = text;
  var container = document.getElementById('recent-chat-display');
  container.appendChild(p);
  while (container.childNodes.length > 15)
  {
    container.childNodes[0].remove();
  }
}
IRCClient.prototype.getRandomGoodVibe =function(user){
	var goodVibes = this.goodVibes;
	if(goodVibes.length>0)
	{

        //grab a random thing to say
        var max = (goodVibes.length>0) ? (goodVibes.length-1) : (0); //prevent goodVibes.length from being -1
        var min = 0;
        var indexGoodVibe=Math.floor(Math.random()*(max-min+1)-min);
        //prepare the statement for sending
        var strMsg = goodVibes[indexGoodVibe]
       	//TODO Turn this into a Sanitize function. 
        //Clean up message
        //replace $user with user var
        if (strMsg.search("\\$user")!==-1)
        {
          strMsg=strMsg.replace("\$user",user,"gi")
        }
        if(strMsg.search("\\$channel")!==-1)
        {
        	strMsg=strMsg.replace("\$channel",this.channelName,"gi");
        }
        return strMsg;
     }
}//end getRandomGoodVibe