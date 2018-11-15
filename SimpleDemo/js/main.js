'use strict';

// Set up media stream constant and parameters.

// Audio will not be streamed because it is set to "audio: false" by default.
const mediaStreamConstraints = {
  video: true,
};

// Set up to exchange only video.
const offerOptions = {
  offerToReceiveVideo: 1,
};



// Define initial start time of the call (defined as connection between peers).
let startTime = null;

// Define peer connections, streams and video elements.
const localVideo = document.getElementById('localVideo');
// const remoteVideo = document.getElementById('remoteVideo');
const remoteGroup = document.getElementById('remoteGroup');
const localCanvas = $('#localCanvas')[0];
const photo = $('#photo')[0];

let localStream;
// let remoteStream;
let remoteStreams = [];

let localPeerConnection;
// let remotePeerConnection;
let remotePeers = [];

const max_remote_num = 5;

function create_video_obj(video_id){
    var li = document.createElement('li');
    var video_obj = document.createElement('video');
    var label = document.createElement('label');
    label.innerText = video_id;
    video_obj.id = video_id;
    video_obj.autoplay = true;
    // video_obj.playsinline = true;
    li.appendChild(label);
    li.appendChild(video_obj);
    remoteGroup.appendChild(li);

    video_obj.addEventListener('loadedmetadata', logVideoLoaded);
    video_obj.addEventListener('onresize', logResizedVideo);

    return video_obj;
}



// Define MediaStreams callbacks.

// Sets the MediaStream as the video element src.
function gotLocalMediaStream(mediaStream) {
  localVideo.srcObject = mediaStream;
  localStream = mediaStream;
  console.log('Received local stream.');
  callButton.disabled = false;  // Enable call button.
}

// Handles error by logging a message to the console.
function handleLocalMediaStreamError(error) {
  console.log(`navigator.getUserMedia error: ${error.toString()}.`);
}

// Handles remote MediaStream success by adding it as the remoteVideo src.
function gotRemoteMediaStream(event, remote_video) {
    console.log(event)
  const mediaStream = event.stream;
  remote_video.srcObject = mediaStream;
  var remoteStream = mediaStream;
  remoteStreams.push(remoteStream);
  console.log('Remote peer connection received remote stream.');
}


// Add behavior for video streams.

// Logs a message with the id and size of a video element.
function logVideoLoaded(event) {
  const video = event.target;
  console.log(`${video.id} videoWidth: ${video.videoWidth}px, ` +
        `videoHeight: ${video.videoHeight}px.`);
}

// Logs a message with the id and size of a video element.
// This event is fired when video begins streaming.
function logResizedVideo(event) {
  logVideoLoaded(event);

  if (startTime) {
    const elapsedTime = window.performance.now() - startTime;
    startTime = null;
    console.log(`Setup time: ${elapsedTime.toFixed(3)}ms.`);
  }
}

localVideo.addEventListener('loadedmetadata', logVideoLoaded);
// remoteVideo.addEventListener('loadedmetadata', logVideoLoaded);
// remoteVideo.addEventListener('onresize', logResizedVideo);


// Define RTC peer connection behavior.

// Connects with new peer candidate.
function handleConnection(event) {
  const peerConnection = event.target;
  const iceCandidate = event.candidate;

  if (iceCandidate) {
    const newIceCandidate = new RTCIceCandidate(iceCandidate);
    const otherPeer = getOtherPeer(peerConnection);

    otherPeer.addIceCandidate(newIceCandidate)
      .then(() => {
        handleConnectionSuccess(peerConnection);
      }).catch((error) => {
        handleConnectionFailure(peerConnection, error);
      });

    console.log(`${getPeerName(peerConnection)} ICE candidate:\n` +
          `${event.candidate.candidate}.`);
  }
}

// Logs that the connection succeeded.
function handleConnectionSuccess(peerConnection) {
  console.log(`${getPeerName(peerConnection)} addIceCandidate success.`);
};

// Logs that the connection failed.
function handleConnectionFailure(peerConnection, error) {
  console.log(`${getPeerName(peerConnection)} failed to add ICE Candidate:\n`+
        `${error.toString()}.`);
}

// Logs changes to the connection state.
function handleConnectionChange(event) {
  const peerConnection = event.target;
  console.log('ICE state change event: ', event);
  console.log(`${getPeerName(peerConnection)} ICE state: ` +
        `${peerConnection.iceConnectionState}.`);
}

// Logs error when setting session description fails.
function setSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}.`);
}

// Logs success when setting session description.
function setDescriptionSuccess(peerConnection, functionName) {
  const peerName = getPeerName(peerConnection);
  console.log(`${peerName} ${functionName} complete.`);
}

// Logs success when localDescription is set.
function setLocalDescriptionSuccess(peerConnection) {
  setDescriptionSuccess(peerConnection, 'setLocalDescription');
}

// Logs success when remoteDescription is set.
function setRemoteDescriptionSuccess(peerConnection) {
  setDescriptionSuccess(peerConnection, 'setRemoteDescription');
}

// Logs offer creation and sets peer connection session descriptions.
function createdOffer(description, remotePC) {
  // console.log(`Offer from localPeerConnection:\n${description.sdp}`);

  console.log('localPeerConnection setLocalDescription start.');
  localPeerConnection.setLocalDescription(description)
    .then(() => {
      setLocalDescriptionSuccess(localPeerConnection);
    }).catch(setSessionDescriptionError);

  console.log('remotePeerConnection setRemoteDescription start.');
    remotePC.setRemoteDescription(description)
    .then(() => {
      setRemoteDescriptionSuccess(remotePC);
    }).catch(setSessionDescriptionError);

  console.log('remotePeerConnection createAnswer start.');
    remotePC.createAnswer()
    .then(function(value){createdAnswer(value, remotePC)})
    .catch(setSessionDescriptionError);
}

// Logs answer to offer creation and sets peer connection session descriptions.
function createdAnswer(description, remotePC) {
  console.log(`Answer from remotePeerConnection:\n${description.sdp}.`);

  console.log('remotePeerConnection setLocalDescription start.');
    remotePC.setLocalDescription(description)
    .then(() => {
      setLocalDescriptionSuccess(remotePC);
    }).catch(setSessionDescriptionError);

  console.log('localPeerConnection setRemoteDescription start.');
  localPeerConnection.setRemoteDescription(description)
    .then(() => {
      setRemoteDescriptionSuccess(localPeerConnection);
    }).catch(setSessionDescriptionError);
}


// Define and add behavior to buttons.

// Define action buttons.
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
// const addButton = document.getElementById('addStream');
const pauseButton = document.getElementById('pauseStream');
const modifyButton = document.getElementById('changeStream');
const captureButton = document.getElementById('capture');

// Set up initial action buttons status: disable call and hangup.
callButton.disabled = true;
hangupButton.disabled = true;
modifyButton.disabled = true;
pauseButton.disabled = true;
captureButton.disabled = true;

// Handles start button action: creates local MediaStream.
function startAction() {
  startButton.disabled = true;
  modifyButton.disabled = false;
  pauseButton.disabled = false;
  captureButton.disabled = false;
  navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
    .then(gotLocalMediaStream).catch(handleLocalMediaStreamError);
  console.log('Requesting local stream.');
}

function pauseAction(){
    console.log(localVideo.srcObject.getTracks())
    var video_stream = localVideo.srcObject.getTracks()[0]
    if (video_stream.enabled) {
        video_stream.enabled = false; // Pause
    } else {
        video_stream.enabled = true;  // Un-pause
    }
}

function drawToCanvas(){
    // A lot of actions can be done at video stream
    // var ctx = localCanvas.getContext('2d');
    // console.log(ctx);
    var ctx = localCanvas.getContext('2d');
    ctx.drawImage(localVideo, 0, 0, localCanvas.width, localCanvas.height);

    var pixelData = ctx.getImageData(0, 0, localCanvas.width, localCanvas.height);
    var avg, i;

    // simple greyscale transformation
    for (i = 0; i < pixelData.data.length; i += 4) {
        avg = (pixelData.data[i] + pixelData.data[i + 1] + pixelData.data[i + 2]) / 3;
        pixelData.data[i] = avg;
        pixelData.data[i + 1] = avg;
        pixelData.data[i + 2] = avg;
    }

    ctx.putImageData(pixelData, 0, 0);
    requestAnimationFrame( drawToCanvas );
}

function changeAction(){
    drawToCanvas();
}

function takePhoto(){
    var photo_ctx = photo.getContext('2d');
    photo_ctx.drawImage(localVideo, 0, 0, photo.width, photo.height);
}



// Handles call button action: creates peer connection.
function callAction() {
  // callButton.disabled = true;
  hangupButton.disabled = false;

  console.log('Starting call.');
  startTime = window.performance.now();

  // Get local media stream tracks.
  const videoTracks = localStream.getVideoTracks();
  const audioTracks = localStream.getAudioTracks();
  if (videoTracks.length > 0) {
    console.log(`Using video device: ${videoTracks[0].label}.`);
  }
  if (audioTracks.length > 0) {
    console.log(`Using audio device: ${audioTracks[0].label}.`);
  }

  const servers = null;  // Allows for RTC server configuration.

  // Create peer connections and add behavior.
  if (localPeerConnection == null) {
      localPeerConnection = new RTCPeerConnection(servers);
      console.log('Created local peer connection object localPeerConnection.');

      localPeerConnection.addEventListener('icecandidate', handleConnection);
      localPeerConnection.addEventListener(
          'iceconnectionstatechange', handleConnectionChange);

      localPeerConnection.addStream(localStream);
      console.log('Added local stream to localPeerConnection.');

  }

  if (remotePeers.length == max_remote_num){
      alert("Reach maximum remote peers.")
  } else {
      var remotePeerConnection = new RTCPeerConnection(servers);
      console.log('Created remote peer connection object remotePeerConnection.');

      var i = remotePeers.length;
      var remote_video = create_video_obj("remote-"+i);

      remotePeerConnection.addEventListener('icecandidate', handleConnection);
      remotePeerConnection.addEventListener(
          'iceconnectionstatechange', handleConnectionChange);
      remotePeerConnection.addEventListener('addstream', function(event){gotRemoteMediaStream(event,remote_video)}, false);


      console.log('localPeerConnection createOffer start.');
      localPeerConnection.createOffer(offerOptions)
          .then(function(value){
              createdOffer(value, remotePeerConnection);
          }).catch(setSessionDescriptionError);

      remotePeers.push(remotePeerConnection);
  }
}

// Handles hangup action: ends up call, closes connections and resets peers.
function hangupAction() {
  localPeerConnection.close();
  // remotePeerConnection.close();

  // Close all peers
  if (remotePeers.length > 0){
      console.log("There are " + remotePeers.length + " remote streams. Closing all.")
      for (var r in remotePeers){
          r.close()
      }
      remotePeers = [];
  }

  localPeerConnection = null;
  // remotePeerConnection = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
  console.log('Ending call.');
}


// Add click event handlers for buttons.
startButton.addEventListener('click', startAction);
callButton.addEventListener('click', callAction);
hangupButton.addEventListener('click', hangupAction);
pauseButton.addEventListener('click', pauseAction);
modifyButton.addEventListener('click', changeAction);
captureButton.addEventListener('click', takePhoto);


// Define helper functions.

// Gets the "other" peer connection.
function getOtherPeer(peerConnection) {
  return (peerConnection === localPeerConnection) ?
      remotePeers[remotePeers.length-1] : localPeerConnection;
}

// Gets the name of a certain peer connection.
function getPeerName(peerConnection) {
  return (peerConnection === localPeerConnection) ?
      'localPeerConnection' : 'remotePeerConnection-'+(remotePeers.length - 1);
}

// Logs an action (text) and the time when it happened on the console.
function trace(text) {
  text = text.trim();
  const now = (window.performance.now() / 1000).toFixed(3);

  console.log(now, text);
}
