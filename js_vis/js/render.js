var canvas = document.querySelector("canvas"),
    context = canvas.getContext("2d"),
    width = canvas.width,
    height = canvas.height,
    SCALE = 2.5,
    node_scale = 2,
    nodes = [],
    MAX_VAL = 1200.0,
    MIN_VAL = -500.0,
    SMOOTH = false
    CLIP_SCALE = 0.75;
    ;

var simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(function(d) { return d.id; }).strength(0.5))
    .force("charge", d3.forceManyBody())
    .force("center", d3.forceCenter(width / (SCALE*2), height / (SCALE*2)))
    // .alphaDecay(0);

// d3.select("input[type=range]")
//    .on("input", inputted);

// Change this if the proxy is not on the local machine
var socket = new WebSocket('ws://localhost:8080');
// TODO: We may want to start the socket connection inside a document ready listener like
//document.addEventListener("DOMContentLoaded", function(event) { 
// Start the socket
//});

// socket.binaryType = 'arraybuffer'; should allow us to skip the file reader if we go that route and still do packetization on the client side
// For more see http://blog.mgechev.com/2015/02/06/parsing-binary-protocol-data-javascript-typedarrays-blobs/

// TODO: we currently send json as binary data requiring an extra conversion step. This is silly, but required while using  a "binary" connection. Investigate switching to text based websockets instead
socket.onmessage = function(evt){
  var reader = new FileReader();
  reader.addEventListener('loadend', (e) => {
    var floats = JSON.parse(e.srcElement.result);
    if (SMOOTH) {
      trackaverage(floats);
    }
    var colors = floats.map(function(f) {
      return colorize(f);
    });
  
    redrawColors(colors);
  });

  reader.readAsText(evt.data);
}


d3.json("graph.json", function(error, graph) {
  if (error) throw error;

  nodes = graph.nodes
  simulation
      .nodes(nodes)
      .on("tick", ticked);


  simulation.force("link")
      .links(graph.links);

  function ticked() {
    context.clearRect(0, 0, width, height);

    context.beginPath();
    graph.links.forEach(drawLink);
    context.strokeStyle = "#aaa";
    context.stroke();

//    context.beginPath();
      // TODO: Incorporate a customized node color here
    graph.nodes.forEach(drawNode);
// TOOD: Is there a faster way to render this
/*    context.fill(); */
//    context.strokeStyle = "#fff";
//    context.stroke();
  }
});



function redrawColors(colors){
  for (i = 0; i < colors.length; i++) {
    nodes[i].color = colors[i];
  }

  redraw();
}

//Take the average over all channels and divide each channel by that average
//Optimally take a running average (100-300ms or 10-30 packets)
// Clip at %75 of the maximum over the window and %75 of the minimum
var buffer = [];
var max = 0;
var min = 0;
var buffer_limit = 30;
var avg = 0;
function trackaverage(values){
  if (buffer.length == buffer_limit) {
    buffer.shift();
  }

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

function colorize(value){
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
  
  var hue = (i * (120 - 0)) + 0;
  //var hue = (i * (hue1 - hue0)) + hue0;
  return 'hsl(' + hue + ', 100%, 50%)';
}

function redraw() {
    simulation.on("tick")()
}

function drawLink(d) {
  context.moveTo(d.source.x*SCALE, d.source.y*SCALE);
  context.lineTo(d.target.x*SCALE, d.target.y*SCALE);
}

function drawNode(d) {
  context.beginPath();
  context.moveTo(d.x*SCALE + 3*SCALE*node_scale, d.y*SCALE);
  context.arc(d.x*SCALE, d.y*SCALE, 3*SCALE*node_scale, 0, 2 * Math.PI);

  context.fillStyle = d.color;
  context.fill();
}
