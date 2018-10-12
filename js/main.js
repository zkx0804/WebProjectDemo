'use strict';

// TODO: improve CPU performance ***
// TODO: stable
// TODO: Add function to properly close the video window

if (!Array.prototype.last) {
    Array.prototype.last = function () {
        return this[this.length - 1];
    };
}
;


var isChannelReady = false;
var isInitiator = false;
var isStarted = false;      // Video session hasn't started
var streamStarted = false; // whether Room already started with one client
var localStream;
// var pc;
// var remoteStream;
var turnReady;
var pcs = [];
var stream_ids = [];

// for host
var remoteID = 1;


var default_server = {
    'urls': 'stun:stun.l.google.com:19302'
}


var turn1 = {
    urls: 'turn:numb.viagenie.ca',
    credential: 'muazkh',
    username: 'webrtc@live.com'
}

var turn2 = {
    urls: 'turn:192.158.29.39:3478?transport=udp',
    credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
    username: '28224511:1379330808'
}


var pcConfig = {
    'iceServers': [turn1]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
};

/////////////////////////////////////////////

// Selectors
// var localVideo = document.querySelector('#localVideo');
// var remoteVideo = document.querySelector('#remoteVideo');

function create_video_obj(video_id) {
    var video_obj = document.createElement('video');
    video_obj.id = video_id;
    video_obj.autoplay = true;
    video_obj.muted = true; // Default to mute the video
    return video_obj;
}

var upper_group = document.querySelector("#upper_group");

var localVideo = create_video_obj("localVideo");
var remoteVideo = create_video_obj("remoteVideo");

var remoteGroup = document.querySelector('#remoteGroup');
var host_remotes = document.querySelector("#is_host");
var client_remote = document.querySelector("#is_client");
client_remote.hidden = true;
host_remotes.hidden = true;


/////////////////////////////////////////////////

// var room = 'test';
var room = prompt('Enter room name:');
var room_name = document.querySelector('#room_name');
room_name.innerHTML = room;

// User role
var user_role = prompt("Join as host or client?");
var user_display_role = document.querySelector('#user_role');
user_display_role.innerHTML = user_role;


var is_host = (user_role.toLowerCase() === "host");
if (is_host) {
    host_remotes.hidden = false;
    upper_group.appendChild(localVideo);
} else {
    client_remote.hidden = false;
    upper_group.appendChild(remoteVideo);
    client_remote.appendChild(localVideo)
}


var socket = io.connect();

if (room !== '') {
    socket.emit('create or join', room);
    console.log('Attempted to create or  join room', room);
}

socket.on('created', function (room) {
    console.log('Created room ' + room);
    isInitiator = true;
});

socket.on('full', function (room) {
    console.log('Room ' + room + ' is full');
    alert("Room is full!");

});

socket.on('join', function (room) {
    console.log('Another peer made a request to join room ' + room);
    isChannelReady = true;
});

socket.on('joined', function (room) {
    console.log('joined: ' + room);
    isChannelReady = true;
});

socket.on('streamStarted', function (value) {
    console.log('Video stream started: ' + value);
    streamStarted = value;
});


socket.on('log', function (array) {
    console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message) {
    console.log('Client sending message: ', message);
    socket.emit('message', message);
}

// This client receives a message
socket.on('message', function (message) {
    console.log('Client received message:', message);
    if (message === 'got user media') {
        maybeStart();
    } else if (message.type === 'offer') {
        if (!isInitiator && !isStarted) {
            maybeStart();
        }
        pcs.last().setRemoteDescription(new RTCSessionDescription(message));
        doAnswer(pcs.last());
    } else if (message.type === 'answer' && isStarted) {
        pcs.last().setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
        var candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
        });
        pcs.last().addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
        handleRemoteHangup();
    }
});

////////////////////////////////////////////////////

navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
})
    .then(gotStream)
    .catch(function (e) {
        alert('getUserMedia() error: ' + e.name);
    });

function gotStream(stream) {
    console.log('Adding local stream.');
    localStream = stream;
    localVideo.srcObject = stream;
    sendMessage('got user media');
    if (isInitiator) {
        maybeStart();
    }
}

var constraints = {
    video: true,
    audio: false
};

console.log('Getting user media with constraints', constraints);

if (location.hostname !== 'localhost') {
    requestTurn(
        'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
    );
}

function maybeStart() {
    console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
    if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
        console.log('>>>>>> creating peer connection');
        var pc = createPeerConnection();
        pc.addStream(localStream);
        isStarted = true;
        console.log('isInitiator', isInitiator);
        if (isInitiator) {
            doCall(pc);
        }
    }
}

window.onbeforeunload = function () {
    sendMessage('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
    try {
        var pc = new RTCPeerConnection(null);
        pc.onicecandidate = handleIceCandidate;
        pc.ontrack = handleRemoteStreamAdded;
        pc.onremovestream = handleRemoteStreamRemoved;
        console.log('Created RTCPeerConnnection');
        pcs.push(pc);
        return pc;
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
}

function handleIceCandidate(event) {
    console.log('icecandidate event: ', event);
    if (event.candidate) {
        sendMessage({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        });
    } else {
        console.log('End of candidates.');
    }
}

function handleCreateOfferError(event) {
    console.log('createOffer() error: ', event);
}

function doCall(pc) {
    console.log('Sending offer to peer');
    pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer(pc) {
    console.log('Sending answer to peer.');
    pc.createAnswer().then(
        setLocalAndSendMessage,
        onCreateSessionDescriptionError
    );
}

function setLocalAndSendMessage(sessionDescription) {
    pcs.last().setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
    trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
    var turnExists = false;
    for (var i in pcConfig.iceServers) {
        if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
            turnExists = true;
            turnReady = true;
            break;
        }
    }
    if (!turnExists) {
        console.log('Getting TURN server from ', turnURL);
        // No TURN server. Get one from computeengineondemand.appspot.com:
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var turnServer = JSON.parse(xhr.responseText);
                console.log('Got TURN server: ', turnServer);
                pcConfig.iceServers.push({
                    'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
                    'credential': turnServer.password
                });
                turnReady = true;
            }
        };
        xhr.open('GET', turnURL, true);
        xhr.send();
    }
}


// TODO: Add function to determine whether it's host or client
function handleRemoteStreamAdded(event) {
    if (is_host) {
        console.log(event.streams)
        var remoteS = event.streams[0];
        var remote_video = document.getElementById(remoteS.id); // Seems having issue with chrome, chrome has {}
        stream_ids.push(remoteS.id);
        if (!remote_video){
            remote_video = create_video_obj(remoteS.id);
            remoteGroup.appendChild(remote_video);
        }
        if (!remote_video.srcObject || remote_video.srcObject.id !== remoteS.id) {
            remote_video.srcObject = remoteS;
        }
    } else {
        console.log('Remote stream added.');
        console.log(event)
        var remoteStream = event.streams[0];
        // remoteVideo.srcObject = remoteStream;
        if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== remoteStream.id) {
            remoteVideo.srcObject = remoteStream;
        }
    }

}

function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
}

function hangup() {
    console.log('Hanging up.');
    stop();
    sendMessage('bye');
}

function handleRemoteHangup() {
    console.log('Session terminated.');
    stop();
    isInitiator = false;
}

function stop() {
    isStarted = false;
    for (var p in pcs) {
