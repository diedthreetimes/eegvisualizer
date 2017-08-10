var canvas = document.querySelector("canvas"),
    context = canvas.getContext("2d"),
    width = canvas.width,
    height = canvas.height,
    SCALE = 2.5,
    node_scale = 2,
    nodes = [],
    MAX_VAL = 1200.0,
    MIN_VAL = -500.0
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
  // Probably want something like https://github.com/Enideo/jquery-colors
  // For now we do simple things with hues
  // Optimally lets work between two hues
  //
  // function percentageToHsl(percentage, hue0, hue1) {
  //  var hue = (percentage * (hue1 - hue0)) + hue0;
  //  return 'hsl(' + hue + ', 100%, 50%)';
  //}
  
  // Map value to a 0...1 scale
  var i = (value - MIN_VAL) / (MAX_VAL - MIN_VAL)
  
  if (i < 0) {
    console.log(value);
    i = 0.0;
  } else if (i > 1) {
    console.log(value);
    i = 1.0;
  }
  
  // convert decimal to hue
  var hue = i * 1.2 / 360;
  var rgb = hslToRgb(hue, 1, .5);
  
  // format to hex string and return
  return 'rgb('+rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
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

// Cdoe function from:
//     https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
function hslToRgb(h, s, l){
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
