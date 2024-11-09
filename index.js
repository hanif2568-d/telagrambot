
var express = require('express');
require('dotenv').config();
var Game = require('./Game');
const collection = require("./config");
const Mongostore = require("connect-mongo");
var app = express();
const HERTZ = 30; //Game updates per second
const port = process.env.PORT 
var server = require('http')
	.createServer(app)
	.listen(port);
var io = require('socket.io')(server);
const uNRegex = new RegExp('^[a-zA-Z0-9_.-]{3,}$');

app.use(express.static(__dirname + '/node_modules'));
app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res, next) {
	res.sendFile(__dirname + '/public/index.html');
});

//User class
class User {
	constructor(socket) {
		this.socket = socket;
		this.username = socket.id;
		this.game = { id: null, playing: false };
	}
}

//Stores all connected users
let users = {};
let matchmaking = [];
let games = {};
var gameend=0;
var caunt=1;
var userbalance=50;
async function pointer(winer,loser) {
	caunt=3;
	const dataofloser = await collection.findOne({ googleId: loser });
	const dataofwinner = await collection.findOne({ googleId: winer});
	
	const losercoin = dataofloser.coin;
	const winnercoin = dataofwinner.coin;
	const yasyazobet = 10; // Amount of coins to transfer
  
	const tcloser = losercoin - yasyazobet;
	const tcwinner = winnercoin + yasyazobet;
  
	// Update coins for loser and winner
	await collection.findByIdAndUpdate(dataofloser._id, { $set: { coin: tcloser } });
	await collection.findByIdAndUpdate(dataofwinner._id, { $set: { coin: tcwinner } });
  
	console.log('Updated loser coin:', tcloser);
	console.log('Updated winner coin:', tcwinner);
	
	
	
  
}
//Manages sockets
io.on('connection', async(socket) => {
     gameend=0;
	 caunt=1;
	console.log(`New client connected: ${socket.id}`);
	
	  
	users[socket.id] = new User(socket);
	socket.broadcast.emit('player-broadcast', Object.keys(users).length);
	socket.emit('player-broadcast', Object.keys(users).length);
	//Checks for duplicate usernames
	
	socket.on('set-username', async (username, callback) => {
        const idofgoogle = username.google;
        console.log("Google ID for query:", idofgoogle); // Log the ID for verification
        const cleanedId = idofgoogle.trim();

        // Attempt to find user data in the database
        const userdata = await collection.findOne({ googleId: cleanedId }).catch(e => {
            console.error("Error querying user data:", e);
            callback(false); // Handle error with callback
            return null;
        });

        console.log("User data found:", userdata);

        if (userdata === null || userdata.coin < 10 || !uNRegex.test(username.name)) {
            console.log("Invalid username or insufficient coins.");
            callback(false);
            return;
        }

        // Check for duplicate usernames
        let same_username = Object.values(users).some(user => user.username === username.name);
        if (same_username) {
            console.log("Username is already in use.");
            callback(false);
            return;
        }

        console.log(`${users[socket.id].username} set their username to ${username.name}`);
        users[socket.id].username = username.name;
        users[socket.id].googleid = cleanedId;

        callback(true);
        socket.emit('matchmaking-begin');
        matchMaker(socket.id);
    });

	socket.on('get-ping', callback => {
		callback(true);
	});

	//Disconnects user
	socket.on('disconnect', () => {
		console.log(`Client Disconnected: ${users[socket.id].username}`);
		delete users[socket.id];
		socket.broadcast.emit('player-broadcast', Object.keys(users).length);
		if (matchmaking.length != 0 && matchmaking[0] == socket.id) {
			matchmaking = [];
		}
		//Removes user from current game and notifices other player - could use the game-id from player object but cbs
		for (key in games) {
			let game = games[key];
			if (game.player1 == socket.id) {
				users[game.player2].socket.emit('player-left');
				delete games[key];
			} else if (game.player2 == socket.id) {
				users[game.player1].socket.emit('player-left');
				delete games[key];
			}
		}
	});
});

//Very simple matchmaking, as soon as theres two people in queue it matches them together
//theoretically there should never be more than two people in the queue at any one time.
function matchMaker(new_player) {
	if (matchmaking.length != 0) {
		var game = new Game(
			matchmaking[0],
			users[matchmaking[0]].username,
			new_player,
			users[new_player].username
		);
		games[game.id] = game;

		//This is all completely un-needed but may be useful for future additions to the game
		users[matchmaking[0]].game.id = game.id;
		users[new_player].game.id = game.id;
		users[matchmaking[0]].game.playing = true;
		users[new_player].game.playing = true;

		//Tells players that a game has started - allows client to initialise view
		users[matchmaking[0]].socket.emit('game-started', {
			username: users[matchmaking[0]].username,
			player: 1,
			opp_username: users[new_player].username,
			ball: game.ball
		});
		users[new_player].socket.emit('game-started', {
			username: users[new_player].username,
			player: 2,
			opp_username: users[matchmaking[0]].username
		});
		console.log(`Game ${game.id} has started.`);
		matchmaking = [];
	} else {
		matchmaking.push(new_player);
	}
}

//Sends new game data to each of the respective players in each game, every x milliseconds
setInterval(() => {
	for (key in games) {
		let game = games[key];
    
		game.update();
		data = {
			1: {
				score: game.players[game.player1].score,
				pos: game.players[game.player1].pos
			},
			2: {
				score: game.players[game.player2].score,
				pos: game.players[game.player2].pos
			},
			ball: game.ball
		};
		users[game.player2].socket.emit(
			'game-data',
			{
				score: data[2].score,
				opp_score: data[1].score,
				opp_pos: data[1].pos,
				ball: data.ball,
				over:gameend
			},
			callback => {
				game.players[game.player2].pos = callback;
			}
		);
		users[game.player1].socket.emit(
			'game-data',
			{
				score: data[1].score,
				opp_score: data[2].score,
				opp_pos: data[2].pos,
				ball: data.ball,
				over:gameend
			},
			callback => {
				game.players[game.player1].pos = callback;
			}
		);

      //it is working mony trnsation sestem users[game.player1].googleid and users[game.player2].googleid
		if(game.players[game.player1].score==7){
            
		console.log('winerId:',users[game.player1].googleid)
		console.log('loserId:',users[game.player2].googleid)
		const winerplayer=users[game.player1].googleid
		const loserplayer=users[game.player2].googleid
		gameend=1;
		if(caunt==1){
      pointer(winerplayer,loserplayer);
		}
		

		}else{

			if(game.players[game.player2].score==7){
				console.log('winerId:',users[game.player2].googleid)
				console.log('loserId:',users[game.player1].googleid)
				const winerofplayer=users[game.player2].googleid
		        const loserofplayer=users[game.player1].googleid
				gameend=1;
				if(caunt==1){
				pointer(winerofplayer,loserofplayer);
				
			}
				
				
              
			}
		}
	}
}, (1 / HERTZ) * 1000);