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
  canvas.width = 560;
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
		editor.setCode('#include<iostream>\nusing namespace std;\nfloat some_func(string s,float x);\n\nint main() {\n  some_func("my arg",4);\n}\n\nfloat some_func(string s,float x){\n  string s2;\n  cout << "enter a string: ";\n  getline(cin,s2);\n  int y=5;\n  cout << s << s2 << endl;\n  return x * x * y;\n}\n');
	}
	else if (prog=='mult_test_1') {
		editor.setCode('#include<iostream>\nusing namespace std;\n\nfloat mult5(float x) {\n    return 5 * x;\n}\n\nfloat mult7(float x) {\n    return 7 * x;\n}\n\nint main() {\n    cout << mult5(3) << endl;\n    cout << mult7(3) << endl;\n    return 0;\n}\n');
	}
	else if (prog=='mult_test_2') {
		editor.setCode('#include<iostream>\nusing namespace std;\n\nfloat mult5(float x) {\n    return 5 * x;\n}\n\nfloat mult7_5(float x) {\n    return 7 * x * mult5(2);\n}\n\nint main() {\n    cout << mult7_5(3) << endl;\n    return 0;\n}\n');
	}
	else if (prog=='scope_ex') {
		editor.setCode("#include<iostream>\nusing namespace std;\nint main()\n{\n    int a = 0; // scope of the first 'a' begins\n    int b = 0;\n    ++a; // the name 'a' is in scope and refers to the first 'a'\n    for (int i=0;i<3;i++){\n        int a = 4; // scope of the second 'a' begins\n                   // scope of the first 'a' is hidden\n        b = b + a + i; // 'a' is in scope and refers to the second 'a'                 \n    } // block ends, scope of the second 'a' ends, scope of 'i' ends\n      //             scope of the first 'a' resumes\n    cout << a << \",\" << b << endl;\n    cout << i << endl; // error! ('i' not in scope)\n    return 0;\n} // block ends, scope of 'a' and 'b' ends\n");
	}
	else if (prog=='recursion_ex_1') {
		editor.setCode('#include<iostream>\nusing namespace std;\n\nvoid recurse(int x){\n  cout << "x: " << x << endl;\n  recurse(x+1);\n}\nint main(){\n        recurse(0);\n        return 0;\n}\n');
	}
	else if (prog=='count_down_recurse') {
		editor.setCode('#include<iostream>\nusing namespace std;\n\nvoid countDown(int count){\n        if (count<0) return;\n        cout << count << endl;\n        countDown(count-1);\n}\nint main(){\n        countDown(3);\n}\n');
	}
	else if (prog=='count_up_recurse') {
		editor.setCode('#include<iostream>\nusing namespace std;\n\nvoid countUp(int count){\n        if (count<0) return;\n        countUp(count-1);\n        cout << count << endl;\n}\nint main(){\n        countUp(3);\n}');
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
	gdb_spinner = new Spinner(spinnerOpts).spin(document.getElementById('run_options'));
	document.getElementById("next").disabled=true;
	document.getElementById("run").disabled=true;
}

function stopSpinner(){
	if (typeof gdb_spinner !== 'undefined') gdb_spinner.stop();
	document.getElementById("next").disabled=false;
	document.getElementById("run").disabled=false;
}

function compileProg() {
  console.log("Compiling...");
  startSpinner();
  prog_console.resetNewText();
  sendGdbMsg('compile',editor.getCode(),compileResult)  // post the program to be compiled
}

function compileResult(response){
	stopSpinner();
	if (response['returncode']==0) {
  		console.log("No compilation errors.");
  		stopSpinner();
  		startStepping();
  	}
  	else {
  		console.log("Compilation errors, see console.");
  		prog_console.setCode(prog_console.getCode()+response['output'])
  		prog_console.resetNewText;
  	}
}

function runProg() {
	// enable stop button
	document.getElementById("stop").disabled=false;
	startSpinner();
	// TODO: ensure program only runs for a maximum of one minute
	sendGdbMsg('run','',runResult);
}

function runResult(response){
	stopSpinner();
	// disable stop button
	document.getElementById("stop").disabled=true;
	consoleUpdate();
}

// this function will query gdb every three seconds to see if there is any output from the console
function consoleUpdate(){
	// send a blank gdb_command, which will return the console output as well
	sendGdbMsg('get_console_output','',consoleResponse);
	updateProgramState('');
	consoleUpdate.timer = setTimeout(consoleUpdate,3000);
}

function consoleResponse(result){
	console.log('Updating console...');
	consoleResponse.res = result;
	prog_console.setCode(prog_console.getCode()+result['console'])
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
  			//if (response['command'] != 'console_command') {
  				prog_console.setCode(prog_console.currentCode+response['console']);
  				prog_console.resetNewText;
  				
  			//}
  		}
}

function sendGdbMsg(command,data_val,next_func){
  // sends a command to gdb and then calls next_func with the result
  console.log("SENDING GDB MSG:\n\tcommand:"+command+"\n\tdata_val:"+data_val+"\n\tnext_func:"+next_func.name);
  var timestamp = Date.now();
  console.log("Timestamp:"+timestamp);
  $.post("cgi-bin/server_comms.cgi",{'uuid':my_guid,'command':command,'data':data_val,'timestamp':timestamp},
  	function(data){
		console.log("Back from call, timestamp:"+timestamp);
  		sendGdbMsg.data = data;
  		stopSpinner();
  		if (data.match("A problem occurred in a Python script.")) {
  			if (data.match("Connection refused")) {
  				alert("There was an error connecting to the server. It is probably down.");
  			}
  			else {
  				alert("There was an error in the script.");
  			}
			console.log(data);
  		}
  		else {
  			console.log("data recd:"+data);
			var response=JSON.parse(data);
			// add command to response for handling
			response['command']=command;
			// handle gdb output
			next_func(response);
  		}
  	});
}

function startStepping(){
  console.log("Starting program...");
  // run the program in gdb
  startSpinner();
  sendGdbMsg('load','',updateWindows);
}

function nextStep(){
	console.log("Sending 'next' to gdb");
	startSpinner();
	sendGdbMsg('gdb_command','next',updateWindows);
}

function updateProgramState(gdb_msg){
	console.log("orig msg:"+gdb_msg);
	startSpinner();
	// send status command to gdb to find line, args, and locals
	sendGdbMsg('status','', function(response) {
		stopSpinner();
		if (typeof(response.error) != 'undefined') {
			console.log('Error on update: '+response.error);
			return;
		}
		console.log("status response:"+response['gdb']);
		resp=response['gdb'];
		prog_args = response['gdb'][0] // arguments for all frames
		prog_frames = response['gdb'][1] // all frames
		prog_locals = response['gdb'][2] // array of frames with local vars
		
		if (prog_args.class_ === 'error') {
			console.log("Resetting program.");
			// restart and go to line 1 (but allow "run")
			document.getElementById("next").disabled=true;
			document.getElementById("run").disabled=true;
			document.getElementById("stop").disabled=true;
			editor.clearHighlights();
			updateProgramState.lineNum=1;
			editor.highlight(updateProgramState.lineNum,"Blue");
			clearDrawing();
			if(typeof consoleUpdate.timer != 'undefined') {
				clearInterval(consoleUpdate.timer);
			}
		}
		else {
			// convert prog_locals to a better array
			var p_locals = []
			for (var i=0;i<prog_locals.length;i++) {
				p_locals.push(prog_locals[i].result.locals);
			}
			parse_status(prog_args.result['stack-args'],prog_frames.result.stack,p_locals);
		}
	});
}

function parse_status(prog_args,prog_frames,prog_locals) {
	p_args = prog_args; p_frames=prog_frames; p_locals=prog_locals;
	parse_status.stack_frames = [];
	for (var i=0;i<prog_frames.length;i++) { // will go through all frames	
		// prog_args is an array of frame dicts, 'frame':{"args":[], "level":"0"}
		// prog_frames is an array of frames, 'frame':{'func':func_name, 'line':lineNo}
		// prog_locals is an array of local variables, each array index
		//       corresponds to the frame
		func = prog_frames[i].frame.func;
		args = prog_args[i].frame.args;
		locals = prog_locals[i];
		line_num = prog_frames[i].frame.line;
		// update line number in window
		if (parseInt(prog_frames[i].frame.level)==0) { // this is the current function
			// update highlighting
			editor.clearHighlights();
  			editor.highlight(line_num,"Blue");
		}
		// convert args
		parse_status.stack_frames.push({'function':func,'args':args,'line_num':line_num,'locals':locals});
	}
	draw_stack(parse_status.stack_frames);
}

function draw_stack(stack_frames) {
	sf = stack_frames;
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
		ctx.fillStyle = 'black';
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
      			all_args+=arg['name']+':'+arg['value']+", ";
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
      			all_locals+=local['name']+':'+local['value']+", ";
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
		ctx.strokeStyle = 'black';
		ctx.stroke();
		
		y_pos-=font_pt+10;
      		// draw arrow?
	}
	
}

function clearConsole() {
	prog_console.setCode("");
	prog_console.resetNewText();
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
, top: '50%' // Top position relative to parent
, left: '70%' // Left position relative to parent
, shadow: false // Whether to render a shadow
, hwaccel: false // Whether to use hardware acceleration
, position: 'absolute' // Element positioning
}


