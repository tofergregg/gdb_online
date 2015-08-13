var ecoInterp;
var ecoRunning=null;
var ecoTimestep=1000;
var ecosimHeight=500;
var ecosimWidth=1000;

function init() {
  my_guid=guid(); // make global
  updateProgramState.lineNum=1;
  editor.clearHighlights();
  editor.highlight(1,"Blue");
  document.getElementById("next").disabled=true;
  document.getElementById("run").disabled=true;
  
  // set up canvas
  var canvas = document.getElementById("drawingArea");
  canvas.height = 580;
  canvas.width = 500;
  var ctx = canvas.getContext("2d");
  //ctx.fillStyle = "#00FF00";
  //ctx.fillRect(2, 0, 496, 580);
}
function load_prog_from_select() {
	var selectId = document.getElementById('selectBox');
	var selectedValue = selectBox.options[selectBox.selectedIndex].value;
	load_prog(selectedValue);
}
function load_prog(prog) {
	if (prog=='square') {
		editor.setCode('#include<iostream>\nusing namespace std;\nfloat square(float x);\n\nint main() {\n  float num, result;\n\n  cout << "Enter a number: ";\n  cin >> num;\n  result = square(num);\n  cout << num << " squared is " << result << endl;\n  return 0;\n}\n\nfloat square(float x){\n  return x * x;\n}\n');
	}
	else if (prog=='fib') {
		editor.setCode("#include<iostream>\nusing namespace std;\n\nint fib(int num);\n\nint main(){\n	int num, result;\n	\n	cout << \"Which Fibonnaci number would you like? \";\n	cin >> num;\n	\n	result = fib(num);\n	\n	cout << \"Fib \" << num << \" is \" << result << \".\" << endl;\n	\n	return 0;\n}\n\nint fib(int num) {\n	if (num==0) return 0;\n	if (num==1) return 1;\n	\n	return fib(num-1) + fib(num-2);\n}\n");
	}
	else if (prog=='func_test') {
		editor.setCode('#include<iostream>\nusing namespace std;\nfloat square(string s,float x);\n\nint main() {\n  square("abc,)\\"def",4);\n}\n\nfloat square(string s,float x){\n  string s2;\n  cout << "enter a string: ";\n  getline(cin,s2);\n  int y=5;\n  cout << s << s2 << endl;\n  return x * x * y;\n}\n');
	}
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
  		prog_console.setCode(prog_console.getCode()+response['output'])
  	}
}

function updateWindows(response){
	if (response['error'] != null) {
  			console.log("comms returned an error: "+response['error']);
  			if (response['error'].match('uuid does not have associated gdb instance.')) {
  				alert("Session may have timed out. You will have to re-compile your program.");
  				init();
  			}
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
	console.log("orig msg:"+gdb_msg);
	// send "where full" command to gdb to find line, args, and locals
	sendGdbMsg('gdb_command','where full', function(response) {
			console.log("where response:"+response['gdb']);
			if (response['gdb'].match('No stack.')) {
				// restart and go to line 1 (but allow "run")
				document.getElementById("next").disabled=true;
				editor.clearHighlights();
				updateProgramState.lineNum=1;
				editor.highlight(updateProgramState.lineNum,"Blue");
				clearDrawing();
			}
			else if (response['gdb']=='') return; // possibly waiting for program input
			else {
				parseWhereFull(response['gdb']);
			}
		});
}

function parse_func_name(line){
	// function name should be "#d.*  name ("
	// but it could read: #1  0x0000000000400947 in main ()
	var func_full = line.match(/^#\d+  .* \(/);
	
	// if " in " remains, get rid of it.
	if (func_full[0].match(/ in /)) {
		func = func_full[0].replace(/^.* in /,"");
		func = func.replace(/ \($/,"");
	}
	else {
		// remove all the way to the function name
		var func = func_full[0].split(" ")[2];
	}
	// return the function name and the rest of the line after the function name and space
	return [func,line.slice(func_full[0].length)];
}

function parse_arguments(line){
	// arguments should be a comma separated list followed by a right parenthesis
	// Beware: must parse individual letters and look for strings with (possibly)
	// escaped quotation marks.
	// e.g.: s="abc,)\"def", x=4) at
	var all_args = []
	var orig_line = line
	var done_with_args = false;
	
	while (!done_with_args) {
		var arg_name="",arg_value="";
		line_sp = line.split('=');
		if (line_sp == line) break; // no more args
		arg_name = line_sp[0];
		// truncate the rest of the line after the equals sign
		line = line.slice(arg_name.length+1)
		//console.log("rest of line:"+line);
		
		// look through each character, and add to arg_value
		// arg value will be complete at a comma, but
		// we must include a string, which could have commas
		var char_index = 0;
		var in_quote = false;
		var last_char = ""
		
		while (true) {
			c = line[char_index];
			if (!in_quote && c==')') { // done with all args!
				done_with_args = true;
				break;
			}
			if (!in_quote && c==',') break; // done with this arg!
			arg_value+=c;
			if (c=='"') {
				if (last_char != '\\') { // not an escaped quote
					in_quote=!in_quote;
				}
			}
			last_char = c;
			char_index++;
		}
		all_args.push({'arg':arg_name,'value':arg_value})
		line = line.slice(char_index+2); // discard the comma and space
	}
	//console.log(all_args);
	
	// return the args and the rest of the line after the function name and space
	return[all_args,line.slice(char_index)];
}

function parse_line_num(text){
	// line will end with a colon and the line number
	text_sp = text.split(':');
	line_num = parseInt(text_sp[text_sp.length-1])
	if (isNaN(line_num)) return -1;
	return line_num;
}

function parse_local(line){
	line = line.replace(/^ */,""); // remove leading spaces
	line_sp = line.split(/=(.+)?/); // split on first equals sign
	line_sp[0] = line_sp[0].replace(/ $/,""); // remove trailing space
	line_sp[1] = line_sp[1].replace(/^ /,""); // remove leading space
	
	// gdb sometimes can't grab the value, so it gives an error, which begins with "<"
	if (line_sp[1][0] == "<") {
		line_sp[1]="<?>";
	}
	line_sp.pop(); // there will be an extra element at the end that we don't need
	//console.log(line_sp);
	return {'var':line_sp[0],'value':line_sp[1]}; // this should be something like {'arg':'num','value':'42'}
}
function parseWhereFull(text){
	// example output from "where full":
	// #0  square (x=3) at /tmp/programs/cdcc5e52-2bda-8d9f-6062-5d1204406d1b.cpp:16
	// No locals.
	// #1  0x0000000000400947 in main () at /tmp/programs/cdcc5e52-2bda-8d9f-6062-5d1204406d1b.cpp:10
	//         num = 3
	//         result = 4.59163468e-41
	// (gdb) 
	lines = text.split('\n');
	parseWhereFull.stack_frames = []
	
	// loop through stack frames
	line_index = 0; // the first line of text
	while (true) {
		var func, args, locals=[], rest_of_line;
		
		// first line should be #0, and contain the function and parameters
		line = lines[line_index];
		//console.log("line text:"+line);
		
		// if the line doesn't start with a hash, we're done
		if (line[0] != "#") break;
		
		var ret_arr = parse_func_name(line);
		func=ret_arr[0];
		rest_of_line = ret_arr[1];
		
		ret_arr = parse_arguments(rest_of_line);
		args=ret_arr[0];
		rest_of_line = ret_arr[1];
		
		line_num = parse_line_num(rest_of_line);
		
		console.log("function: "+func);
		console.log("args:");
		for (key in args) {
			console.log("\t"+args[key]['arg']+":"+args[key]['value']);
		}
		console.log("line number: "+line_num);
		if (line_index==0) { // this is the current function
			// update highlighting
			editor.clearHighlights();
  			editor.highlight(line_num,"Blue");
		}
		
		line_index++;
		
		// next lines will be local variables
		line = lines[line_index];
		if (line.match("No locals.")) { // no local variables
			line_index++;
		}
		else {
			// the next lines will all start with a bunch of spaces, then the variable name
			while (line[0] == " ") {
				locals.push(parse_local(line))
				line_index++;
				line = lines[line_index];
			}
		}
		console.log("locals:");
		for (key in locals) {
			console.log("\t"+locals[key]['var']+":"+locals[key]['value']);
		}
		parseWhereFull.stack_frames.push({'function':func,'args':args,'line_num':line_num,'locals':locals});
	}
	draw_stack(parseWhereFull.stack_frames);
}

function draw_stack(stack_frames) {
	// draw the stack frame on the canvas
	var canvas = document.getElementById("drawingArea");
	var ctx = canvas.getContext("2d");
	//canvas.height = 580;
	//canvas.width = 500;
	
	clearDrawing();
	
	// draw each stack frame, from the bottom up
	var y_pos = canvas.height-10;
	var x_pos = canvas.width/2;
	
	var font_pt = 12;
	
	for (var i=stack_frames.length-1;i>=0;i--){
		var max_text_width=0;
		var orig_y = y_pos;
		var frame = stack_frames[i];
		var text;
		// draw function name
		ctx.fillStyle = 'white';
		ctx.textAlign = 'center';
		ctx.font = font_pt+'pt Sans-Serif';
		text = frame['function']+'(), line '+frame['line_num'];
      		
      		text_width = ctx.measureText(text).width;
      		if (text_width > max_text_width)
      			max_text_width = text_width;
      		ctx.fillText(text, x_pos, y_pos);
      		y_pos-=font_pt+8;
      		
      		// draw arguments
      		var all_args="args: ";
      		for (var j in frame['args']) {
      			arg=frame['args'][j];
      			all_args+=arg['arg']+':'+arg['value']+", ";
      		}
      		text_width = ctx.measureText(all_args).width;
      		if (text_width > max_text_width)
      			max_text_width = text_width;
      			
      		ctx.fillText(all_args, x_pos, y_pos);
      			y_pos-=font_pt+8;

      		// draw locals
      		var all_locals="locals: ";
      		for (var j in frame['locals']) {
      			local=frame['locals'][j];
      			all_locals+=local['var']+':'+local['value']+", ";
      		}
      		text_width = ctx.measureText(all_locals).width;
      		if (text_width > max_text_width)
      			max_text_width = text_width;
      			
      		ctx.fillText(all_locals, x_pos, y_pos);
      		y_pos-=font_pt+15;
      		
      		// draw box
		ctx.beginPath();
		ctx.rect(x_pos-max_text_width/2-5,orig_y-14,max_text_width+10,y_pos-orig_y+20);
		ctx.lineWidth = 2;
		ctx.strokeStyle = 'white';
		ctx.stroke();
		
		y_pos-=font_pt+10;
      		// draw arrow?
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


