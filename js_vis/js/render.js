var canvas = document.querySelector("canvas"),
    context = canvas.getContext("2d"),
    width = canvas.width,
    height = canvas.height,
    SCALE = 2.5,
    node_scale = 2,
    nodes = []//,
// These vars where used for processing the binary stream which we've abandoned for now
    // carry_over_buf,
    // num_processed_bufs = 0, 
    // num_recorded_bufs = 0
    ;

// num_processed_bufs and num_recorded_bufs keep track of an event that may never happen
// When a websocket frame is received before the last one has finished processing
// The best longterm fix for this issue is to create a msg based websocket protocol
//   (this will remove the need for partial (carry over) buffers)

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
  //alert("I got data: " + evt.data);
  //console.log(evt.data.size);
  //console.log(evt.data);
  var reader = new FileReader();
  reader.addEventListener('loadend', (e) => {
    var floats = JSON.parse(e.srcElement.result);
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

function colorize(value){
  console.log(value);

  return "white";
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
