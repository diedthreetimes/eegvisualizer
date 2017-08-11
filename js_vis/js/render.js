var canvas = document.querySelector("canvas"),
    MAX_VAL = 1200.0,
    MIN_VAL = -500.0,
    SMOOTH = true,
    REDUCE_FRAMERATE = true,
    SKIPPED_FRAMES = 100,
    CLIP_SCALE = 0.75,
    HUE_WIDTH = 30;
    ;

// Change this if the proxy is not on the local machine
var socket = new WebSocket('ws://localhost:8080');
// TODO: We may want to start the socket connection inside a document ready listener like
//document.addEventListener("DOMContentLoaded", function(event) { 
// Start the socket
//});

// socket.binaryType = 'arraybuffer'; should allow us to skip the file reader if we go that route and still do packetization on the client side
// For more see http://blog.mgechev.com/2015/02/06/parsing-binary-protocol-data-javascript-typedarrays-blobs/

// TODO: we currently send json as binary data requiring an extra conversion step. This is silly, but required while using  a "binary" connection. Investigate switching to text based websockets instead
var count = 0;
socket.onmessage = function(evt){
  var reader = new FileReader();
  reader.addEventListener('loadend', (e) => {
    var floats = JSON.parse(e.srcElement.result);
    if (SMOOTH) {
      trackaverage(floats);
    }

    if (REDUCE_FRAMERATE) {
      if (count % SKIPPED_FRAMES == 0) {
	redrawColors(floats);
      }
    }
    
    count = count + 1;
  });

  reader.readAsText(evt.data);
}

function redrawColors(values){
  // TODO: Possibly make these selectors globals to avoid unecessary work
  var stop1 = d3.select(".stop1");
  var stop2 = d3.select(".stop2");
  // For each layer set and colorize
  // Set the baground gradient
  stop1.transition().attr('stop-color', colorize(values[0],0));
  stop2.transition().attr('stop-color', colorize(values[1],1));


  // for (i = 0; i < values.length; i++) {    
  //   nodes[i].color = colorize(values[i],i);
  // }
}

//Take the average over all channels and divide each channel by that average
//Optimally take a running average (100-300ms or 10-30 packets)
// Clip at %75 of the maximum over the window and %75 of the minimum
var buffer = [];
var max = 0;
var min = 0;
var window = 150; // TODO: Have the window change based on key events
var avg = 0;
//var count = 0;
function trackaverage(values){
//  count += 1;
  if (buffer.length == window) {
    buffer.shift();
  }

  // if (count % 1200 == 0) {
  //   console.log(values);
  // }

  buffer.push(values)
  
  max = MIN_VAL;
  min = MAX_VAL;
  avg = buffer.reduce(function(sum,arys) {
    return arys.reduce(function(isum,value) {
      if (value > max) {
	max = value;
      }
      if (value < min) {
	min = value;
      }
      return isum + value;
    }, 0) / arys.length;
  }, 0) / buffer.length;
}

var hues = [
235, // Channel 1 - BOTTOM
306, // Channel 2 - TOP
120, // Channel 3 - Green
292, // Channel 4 - Magenta
38, // Channel 5 - Orange
180, // Channel 6 - Cyan
59  // Channel 7 - Yellow // TODO: Some of these may need to be remapped
]
var layer_ids = [ // TODO: Determine the layer ids and the re-style logic
//  GREEN // Channel 3
// MAGENTA // Channel 4
// Orange // Channel 5
"Light_Blue_lines",// Cyan // Channel 6
// Yellow // Channel 7
]
var background_saturation = '85%';
function colorize(value, index){
  // Map value to a 0...1 scale
  if (SMOOTH) { 
    var i = (value/avg - min*CLIP_SCALE/avg) / ((max/avg - min/avg)*CLIP_SCALE);
  } else {
    var i = (value - MIN_VAL) / (MAX_VAL - MIN_VAL);
  }
  
  if (i < 0) {
    i = 0.0;
  } else if (i > 1) {
    i = 1.0;
  }
  
  var hue = (i * (HUE_WIDTH)) + hues[index]-HUE_WIDTH;
  //var hue = (i * (hue1 - hue0)) + hue0;
  ret = ""
  if (index == 0) { // Bottom
    ret =  'hsl(' + hue + ', ' + '85%,65%)';
  } if (index == 1) { // TOP 
    ret =  'hsl(' + hue + ', ' + '100%,41%)';
  }

  ret = 'hsl(' + hue + ', 100%, 100%)'; // TODO: Fiddle with alpha should it be 100?
  
//  console.log(ret);
  return ret;
}
