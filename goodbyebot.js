
function main(){
//connect to server
bot= new IRCClient();
bot.setUserName("GoodbyeBot");
bot.connectToServer(6667,"wright.freenode.net");
bot.goodVibes = ["Goodbye.", "Goodbye, $user"];

//TODO: arg is one of the messages in message.arg array. we only have one spot for msg sender. however, message.messageSender will be populated with whoever sent the arg message.
//		There's probably a cleaner way to do this. Rethink the message object. 

bot.onMessage= function(message, arg){
	//do privmsg special handling here.
	console.log("Calling OnMessage"+message)
//if message is sent to the channel:
if(message.username === this.channelName)
  {
	//if privmsg channel, and you see hello, say goodbye, leave, and rejoin in 10 seconds
	if(arg.search(/hello/i) != -1) 
      {
        
        
      //  console.log(message.msgSender+" that was the message.msgSender");
        //grab a random thing to say
        var strRandomGoodVibe = this.getRandomGoodVibe(message.msgSender); 
        this.write("PRIVMSG " + this.channelName + " :"+strRandomGoodVibe);
        //leave channel.
        this.write("PART "+ bot.channelName);
        //need to join again in 10 seconds.
        setTimeout(function(){bot.write('JOIN ' + bot.channelName);},10000);
      }
  }
//otherwise, its a message directly to me
else
	{
		var messagingUser = message.prefix.slice(1, message.prefix.search("!"));
		write("PRIVMSG " + messagingUser + " :Goodbye");
	}

}
bot.onReady = function(){
	//function called when join is ready.
	if(bot.connected)
		bot.join("#realtestchannel")
}//end onReady
bot.pingResp = function(){
	if(bot.connected)
		this.pong();
}
}//end main
if(window.chrome.socket)
{
  debugger;
  main();

}