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

function compileProg() {
  console.log("Compiling...");
  // post the program to be compiled
  $.post("cgi-bin/compileProg.cgi",{'uuid':my_guid,'program':editor.getCode()}, function(data) {
	var response = JSON.parse(data)
  	prog_console.setCode(prog_console.getCode()+response['output'])
  	if (response['returncode']==0) {
  		console.log("No compilation errors.");
  		startRunning();
  	}
  	else {
  		console.log("Compilation errors, see console.");
  	}
  });
}

function startRunning(){
  console.log("Starting program...");
  // run the program in gdb
  $.post("cgi-bin/server_comms.cgi",{'uuid':my_guid,'command':'load','data':'programs/bin/'+my_guid},
  	function(data){
  		var response=JSON.parse(data);
  		// handle gdb output
  		updateProgramState(response['gdb']);
  		// update console
  		prog_console.setCode(prog_console.getCode()+response['console'])
  	});
}

function nextStep(){
	console.log("Sending 'next' to gdb");
	
}

function updateProgramState(gdb_msg){
	console.log(gdb_msg);
	// for now, just find the first gdb output line that has a number
	lines=gdb_msg.split('\n');
	for (i=0;i<lines.length;i++) {
		lineNum = lines[i].match(/^\d+/);
		if (lineNum) {
			editor.highlight(lineNum,"Blue");
			break;
		}
	}
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

