var ecoInterp;
var ecoRunning=null;
var ecoTimestep=1000;
var ecosimHeight=500;
var ecosimWidth=1000;
var ecoLibrary = (
	"a position has\n" +
	"  x, a number\n" +
	"  y, a number\n" +
	"how to move a position a number up\n" + 
    "  do in order atomically\n" + 
    "    replace the position's y with the position's old y + the number\n" + 
    "    if the position's y > "+ecosimHeight+"\n" + 
    "       replace the position's y with "+ecosimHeight+"\n" + 
    "    if the position's y < 0\n" + 
    "       replace the position's y with 0\n" + 
    
    "how to move a position a number down\n" + 
    "  do in order atomically\n" + 
    "    replace the position's y with the position's old y - the number\n" + 
    "    if the position's y > "+ecosimHeight+"\n" + 
    "       replace the position's y with "+ecosimHeight+"\n" + 
    "    if the position's y < 0\n" + 
    "       replace the position's y with 0\n" + 
    
    "how to move a position a number right\n" + 
    "  do in order atomically\n" + 
    "    replace the position's x with the position's old x + the number\n" + 
    "    if the position's x > "+ecosimWidth+"\n" + 
    "       replace the position's x with "+ecosimWidth+"\n" + 
    "    if the position's x < 0\n" + 
    "       replace the position's x with 0\n" + 
    
    "how to move a position a number left\n" + 
    "  do in order atomically\n" + 
    "    replace the position's x with the position's old x - the number\n" + 
    "    if the position's x > "+ecosimWidth+"\n" + 
    "       replace the position's x with "+ecosimWidth+"\n" + 
    "    if the position's x < 0\n" + 
    "       replace the position's x with 0\n"
);

function init() {
  my_guid=guid(); // make global
  updateProgramState.lineNum=1;
  editor.highlight(1,"Blue");
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

function startSpinner(){
	gdb_spinner = new Spinner(spinnerOpts).spin(document.getElementById('codeText'));
	document.getElementById("next").disabled=true;
	document.getElementById("run").disabled=true;
}

function stopSpinner(){
	gdb_spinner.stop();
	document.getElementById("next").disabled=false;
	document.getElementById("run").disabled=false;
}

function compileProg() {
  console.log("Compiling...");
  startSpinner();
  sendGdbMsg('compile',editor.getCode(),compileResult)  // post the program to be compiled
  /*
  $.post("cgi-bin/compileProg.cgi",{'uuid':my_guid,'program':editor.getCode()}, function(data) {
	var response = JSON.parse(data)
  	prog_console.setCode(prog_console.getCode()+response['output'])
  	if (response['returncode']==0) {
  		console.log("No compilation errors.");
  		stopSpinner();
  		startRunning();
  	}
  	else {
  		console.log("Compilation errors, see console.");
  	}
  });*/
}

function compileResult(response){
	stopSpinner();
	if (response['returncode']==0) {
  		console.log("No compilation errors.");
  		stopSpinner();
  		startRunning();
  	}
  	else {
  		console.log("Compilation errors, see console.");
  	}
}

function updateWindows(response){
	if (response['error'] != null) {
  			console.log("comms returned an error: "+response['error']);
  		}
  		else {
  			updateProgramState(response['gdb']);
  			// update console, but only if it was a gdb_command (to 
  			// avoid duplicating console input)
  			if (response['command'] != 'console_command') {
  				prog_console.setCode(prog_console.getCode()+response['console'])
  			}
  		}
}

function sendGdbMsg(command,data_val,next_func){
  // sends a command to gdb and then calls next_func with the result
  $.post("cgi-bin/server_comms.cgi",{'uuid':my_guid,'command':command,'data':data_val},
  	function(data){
  		sendGdbMsg.data = data;
  		stopSpinner();
  		if (data.match("A problem occurred in a Python script.")) {
  			if (data.match("Connection refused")) {
  				alert("There was an error connecting to the server. It is probably down.");
  			}
  			else {
  				alert("There was an error in the script.");
  			}
  		}
  		else {
			var response=JSON.parse(data);
			response['command']=command;
			// handle gdb output
			next_func(response);
  		}
  	});
}

function startRunning(){
  console.log("Starting program...");
  // run the program in gdb
  startSpinner();
  sendGdbMsg('load','',updateWindows);
}

function nextStep(){
	console.log("Sending 'next' to gdb");
	sendGdbMsg('gdb_command','next',updateWindows);
}

function updateProgramState(gdb_msg){	
	// send "where" command to gdb to find line
	sendGdbMsg('gdb_command','where', function(response) {
			console.log("where response:"+response['gdb']);
			if (response['gdb'].match('No stack.')) {
				// restart and go to line 1 (but allow "run")
				document.getElementById("next").disabled=true;
				editor.clearHighlights();
				updateProgramState.lineNum=1;
				editor.highlight(updateProgramState.lineNum,"Blue");
			}
			else if (response['gdb']=='') return; // possibly waiting for program input
			else {
				lines = response['gdb'].split('\n');
				for (i=0;i<lines.length;i++) {
					if (lines[i].match(/#0/)) {
						lineSplit = lines[i].split(':')
						if (lineSplit.length==1) {
							// oops, no line number, so we just increment by 1
							editor.clearHighlights();
							updateProgramState.lineNum++;
							editor.highlight(updateProgramState.lineNum,"Blue");
							break;
						}
						lineNum = parseInt(lineSplit[lineSplit.length-1])
						editor.clearHighlights();
						updateProgramState.lineNum=lineNum;
						editor.highlight(updateProgramState.lineNum,"Blue");
						break;
					}
				}
			}
		});
}	

function size(width,height) {
  this.width = width;
  this.height = height;
}

function getDrawingArea(){
  dAreaElement = document.getElementById("drawingArea");
  var area = new size(dAreaElement.width,dAreaElement.height);
  return (area);
}

function clearDrawing(){
    var canvas = document.getElementById('drawingArea');  
        if (canvas.getContext){  
          var ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
}

function drawCircle(x,y,radius,color){
    var canvas = document.getElementById('drawingArea');  
        if (canvas.getContext){  
          if (radius < 0) return;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, canvas.height-y, radius, 0, Math.PI * 2, false);
          ctx.closePath();
          ctx.fill();
        }
}

function setCookie(name,value){
    var expiredays = 14; // set two week expiration
    var exdate=new Date();
    exdate.setDate(exdate.getDate()+expiredays);
    document.cookie=name+ "=" +escape(value)+
        ((expiredays==null) ? "" : ";expires="+exdate.toUTCString());
}

function getCookie(c_name)
{
    if (document.cookie.length>0)
      {
      c_start=document.cookie.indexOf(c_name + "=");
      if (c_start!=-1)
        {
            c_start=c_start + c_name.length+1;
            c_end=document.cookie.indexOf(";",c_start);
            if (c_end==-1) c_end=document.cookie.length;
            return unescape(document.cookie.substring(c_start,c_end));
        }
      }
    return "";
}



// Replaces all instances of the given substring.
String.prototype.replaceAll = function(
strTarget, // The substring you want to replace
strSubString // The string you want to replace in.
){
var strText = this;
var intIndexOfMatch = strText.indexOf( strTarget );
 
// Keep looping while an instance of the target string
// still exists in the string.
while (intIndexOfMatch != -1){
// Relace out the current instance.
strText = strText.replace( strTarget, strSubString )
 
// Get the index of any next matching substring.
intIndexOfMatch = strText.indexOf( strTarget );
}
 
// Return the updated string with ALL the target strings
// replaced out with the new substring.
return( strText );
}

var spinnerOpts = {
  lines: 13 // The number of lines to draw
, length: 3 // The length of each line
, width: 2 // The line thickness
, radius: 4 // The radius of the inner circle
, scale: 1 // Scales overall size of the spinner
, corners: 1 // Corner roundness (0..1)
, color: '#000' // #rgb or #rrggbb or array of colors
, opacity: 0.25 // Opacity of the lines
, rotate: 0 // The rotation offset
, direction: 1 // 1: clockwise, -1: counterclockwise
, speed: 1 // Rounds per second
, trail: 60 // Afterglow percentage
, fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
, zIndex: 2e9 // The z-index (defaults to 2000000000)
, className: 'spinner' // The CSS class to assign to the spinner
, top: '4%' // Top position relative to parent
, left: '50%' // Left position relative to parent
, shadow: false // Whether to render a shadow
, hwaccel: false // Whether to use hardware acceleration
, position: 'absolute' // Element positioning
}


