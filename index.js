'use strict';

var max_clients = 3;


var os = require('os');
var fs = require('fs');
var express = require('express');
var https = require('https');
var nodeStatic = require('node-static');
var fileServer = new (nodeStatic.Server)();

var app = express();
app.use(express.static(process.env.SERVE_DIRECTORY || 'dist'));
app.get('/', function(req, res) {
    return fileServer.serve(req, res);
});


const httpsPort = 1234;
var options = {
    key: fs.readFileSync('./resources/key.pem', 'utf8'),
    cert: fs.readFileSync('./resources/server.crt', 'utf8'),
    passphrase: process.env.HTTPS_PASSPHRASE || ''
};

// console.log(options)

var server  = https.createServer(options, app).listen(httpsPort);
// var http = require('http');

var socketIO = require('socket.io');
//
// var fileServer = new (nodeStatic.Server)();
// var app = http.createServer(function (req, res) {
//     fileServer.serve(req, res);
// }).listen(8080);

var io = socketIO.listen(server);
io.sockets.on('connection', function (socket) {

    // convenience function to log server messages on the client
    function log() {
        var array = ['Message from server:'];
        array.push.apply(array, arguments);
        socket.emit('log', array);
    }

    socket.on('message', function (message) {
        log('Client said: ', message);
        // for a real app, would be room-only (not broadcast)
        socket.broadcast.emit('message', message);
    });


    socket.on('create or join', function (room) {
        console.log('Received request to create or join room ' + room);

        var clientsInRoom = io.sockets.adapter.rooms[room];
        var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;

        if (numClients === 0) {
            socket.join(room);
            console.log('Client ID ' + socket.id + ' created room ' + room);

            socket.emit('created', room, socket.id);

        } else if (numClients < max_clients) {
            console.log('Client ID ' + socket.id + ' joined room ' + room);
            io.sockets.in(room).emit('join', room, socket.id);
            socket.join(room);
            socket.emit('joined', room, socket.id);
            io.sockets.in(room).emit('ready');
            console.log('Room ' + room + ' now has ' + numClients + ' client(s)');

            if (numClients > 1) {
                socket.emit('streamStarted', true);
            }

        } else if (numClients === max_clients) {
            socket.emit('full', room);
            console.log("Room is full!")
        }
    });

    socket.on('get rooms list', function () {
        var rooms = io.sockets.adapter.rooms;

        socket.emit('got room list', rooms);

    })

    socket.on('leave', function(){

    })


    socket.on('ipaddr', function () {
        var ifaces = os.networkInterfaces();
        for (var dev in ifaces) {
            ifaces[dev].forEach(function (details) {
                if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                    socket.emit('ipaddr', details.address);
                }
            });
        }
    });

    socket.on('bye', function () {
        console.log('received bye');
    });

});


var testVar = "String from index.js";
module.exports.testVar = testVar;
