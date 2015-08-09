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
 function createXMLHttpRequest() {
   try { return new XMLHttpRequest(); } catch(e) {}
   try { return new ActiveXObject("Msxml2.XMLHTTP"); } catch (e) {}
   alert("XMLHttpRequest not supported");
   return null;
 }
 
function loggedIn(username,ciphertext)
{	
    var validated = false;
    //xmlhttp=new XMLHttpRequest();
    xmlhttp = createXMLHttpRequest();
    if (username=="" || ciphertext=="") return false;
    httpReq = "../cgi-bin/mysqlFunctions.py?username="+username
                 +"&ciphertext="+ciphertext

    xmlhttp.open("GET",httpReq,false);
    
    xmlhttp.send();
    if (xmlhttp.readyState==4 && xmlhttp.status==200)
        {
            response = xmlhttp.responseText;
            if (response.indexOf("Log in success!") != -1) {
                validated = true;
            }
            else validated=false;
        }
    return validated;
}
function loginPageLoaded(){
    mainPageUrl = "index.html"
    var loggedInHash = getCookie("loggedIn");
    var username = getCookie("username");
    var userValidated = loggedIn(username,loggedInHash);
    if (loggedInHash == "" || !userValidated) { // no user is logged in
        ;
    }
    else {
        window.location = mainPageUrl+
                    "?username="+username.value+"&status=newUser";
    }
}

function indexPageLoaded(){
    var loggedInHash = getCookie("loggedIn");
    var username = getCookie("username");
    var userValidated = loggedIn(username,loggedInHash);
    examples = getQueryVariable("example");
    if (loggedInHash == "" || !userValidated) { // no user is logged in
        document.getElementById("loginGreeting").innerHTML='<a href="login.html">login</a>';
        if (examples == "True") loadExampleProgram();
    }
    else {
        document.getElementById("loginGreeting").innerHTML='Welcome, '+username+"!" + 
            ' | <a href="javascript:logout()">logout</a>';
        if (examples == "True") {
            loadExampleProgram();
        }
        else {
            fileNum = parseInt(getQueryVariable("loadCode"));
            if (fileNum > 0) loadFilePageLoaded(fileNum);
            else loadFilePageLoaded(-1);
        }
        document.getElementById("saveButton").disabled="";
        document.getElementById("loadButton").disabled="";
        if (username.toLowerCase()=="chris" || username.toLowerCase()=="luther") {
            // add Save as Example button
            document.getElementById('saveExampleButtonDiv').innerHTML= '<input type="button" id="saveExampleButton" name="saveEx" value="Save as Example" onClick="saveAsExample()" class="regularButton">';
        }
        var numProcs = getCookie("processors");
        var timestep = getCookie("timestep");
        if (numProcs) document.getElementById("numProcs").value = numProcs;
        if (timestep) document.getElementById("timestep").value = timestep;
    }
    // adjust size of canvas to fit screen
    var drawingArea = document.getElementById("drawingArea");
    tableDiv = document.getElementById("tableDiv");
    //drawingArea.width = Math.floor(document.body.clientWidth*0.95);
    //drawingArea.width = Math.floor(tableDiv.offsetWidth*0.99);
    highlightLine(editor,0,"blue",true,true);
  }

function loadFilePageLoaded(fileNum){
    mainPageUrl = "index.html"
    var loggedInHash = getCookie("loggedIn");
    var username = getCookie("username");
    var userValidated = loggedIn(username,loggedInHash);
    if (loggedInHash == "" || !userValidated) { // no user is logged in
        alert("You must log in before loading a file.");
        window.location = mainPageUrl;
    }
    else {
        document.getElementById("loginGreeting").innerHTML=username + 
            ' | <a href="javascript:logout()">logout</a>';
    
        var loggedInHash = getCookie("loggedIn");
        var username = getCookie("username");
        var url = "../cgi-bin/loadCode.py";
        
        var escapedCodeSet = "username="+username+"&ciphertext="+loggedInHash;
        if (fileNum > 0) escapedCodeSet+="&fileNum="+fileNum.toString();
        else if (fileNum == -1) escapedCodeSet+="&loadTemp=True";
        //alert(escapedCodeSet);
        var xhrArgs = {
            url: url,
            postData: escapedCodeSet,
            handleAs: "text",
            load: function(data) {
                if (fileNum > 0 || fileNum == -1) {
                    editor.setCode(unescape(data));
                }
                else {
                    document.getElementById("fileInfo").innerHTML=data;
                }
            },
            error: function(error) {
                alert("error:"+error);
            }
        }
        
        //Call the asynchronous xhrPost
        var deferred = dojo.xhrPost(xhrArgs);    
    }
}

function loadExampleProgram(){
    fileNum = parseInt(getQueryVariable("loadCode"));
    var loggedInHash = "683e64185c59963c5a2bf54675335316";
    var username = "Examples"
    var url = "../cgi-bin/loadCode.py";
    
    var escapedCodeSet = "username="+username+"&ciphertext="+loggedInHash;
    escapedCodeSet+="&fileNum="+fileNum.toString();
    //alert(escapedCodeSet);
    var xhrArgs = {
        url: url,
        postData: escapedCodeSet,
        handleAs: "text",
        load: function(data) {
            editor.setCode(unescape(data));
        },
        error: function(error) {
            alert("error:"+error);
        }
    }
    //Call the asynchronous xhrPost
    var deferred = dojo.xhrPost(xhrArgs);  
}

function saveAsExample(){
    var loggedInHash = "683e64185c59963c5a2bf54675335316";
    var username = "Examples";
    var filename = "untitled"
        filename = prompt("Please enter a file name to save.", filename);
        if (filename == "" || filename ==null) return;
    escapedCode = escape(editor.getCode());
    escapedCode = escapedCode.replaceAll("+","%2B");
    var url = "../cgi-bin/saveCode.py";
     
    var escapedCodeSet = "escapedCode="+escapedCode+"&username="+username+"&ciphertext="+loggedInHash+"&filename="+filename;
    var xhrArgs = {
        url: url,
        postData: escapedCodeSet,
        handleAs: "text",
        load: function(data) {
            alert("Code saved!");
        },
        error: function(error) {
            //We'll 404 in the demo, but that's okay.  We don't have a 'postIt' service on the
            //docs server.
            alert("error:"+error);
        }
    }
    
    //Call the asynchronous xhrPost
    var deferred = dojo.xhrPost(xhrArgs);
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

function convertPw()
{
    document.getElementById("response").innerHTML='';
    document.getElementById("loadingGif").innerHTML='<img src="ajax-loader.gif" />';
    mainPageUrl = "index.html"
    username = document.getElementById('username')
    plaintext = document.getElementById('plaintext')
    ciphertext = document.getElementById('ciphertext')
    newAccount = document.getElementById('newAcct')
    
    ciphertext.value = hex_md5(plaintext.value+username.value.toLowerCase())
    plaintext.value=""
    //$("#loginButton").empty().html('<img src="ajax-loader.gif" />');
    // send request
    //xmlhttp=new XMLHttpRequest();
    xmlhttp = createXMLHttpRequest();
    xmlhttp.onreadystatechange=function()
    {
        if (xmlhttp.readyState==4 && xmlhttp.status==200)
        {
            var response = xmlhttp.responseText;
            document.getElementById("response").innerHTML=response;
            if (response.indexOf("Username / Password Incorrect.") == -1 &&
                    response.indexOf("A user with that name already exists!") == -1 &&
                    response.indexOf("You must submit both a username and a password.") == -1){
                setCookie("loggedIn",ciphertext.value);
                setCookie("username",username.value);
                if (response.indexOf("Successfully created user.") != -1) window.location = mainPageUrl+
                    "?username="+username.value+"&status=newUser";
                else if (response.indexOf("Log in success!") != -1) {
                    window.location = mainPageUrl;
                    //window.location = mainPageUrl+"?username="+username.value
                    //    +"&status=returning";
                }
            }
            else {
                document.getElementById("loadingGif").innerHTML='<img src="1x1.gif" />';
            }
        }
    }
    httpReq = "../cgi-bin/mysqlFunctions.py?username="+username.value
                 +"&ciphertext="+ciphertext.value;
    if (newAccount.checked) httpReq += "&newAccount=true";
    else httpReq += "&newAccount=false";

    xmlhttp.open("GET",httpReq,true);
    xmlhttp.send();
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

function logout(){
    setCookie("loggedIn","none");
    //document.cookie = "loggedIn='';expires=Thu, 01-Jan-1970 00:00:01 GMT";
    document.getElementById("loginGreeting").innerHTML='<a href="login.html">login</a>';
    document.getElementById("saveButton").disabled="true";
    document.getElementById("loadButton").disabled="true";
}

function resetAll(clearDebugText) {
    if (clearDebugText) clearDebug();
    stepForward.currentLine = 1;
    highlightLine(editor,0,"blue",true,true);
    procsSetting = document.getElementById("numProcs");
    procsSetting.disabled = 0;
    editor.enable()
    stopCode();
    document.getElementById("setupButton").disabled="";
    document.getElementById("resetButton").disabled=true;
    document.getElementById("startButton").disabled=true;
    document.getElementById("stopButton").disabled=true;
    document.getElementById("stepButton").disabled=true;
    if (ecoRunning) {
        clearInterval(ecoRunning);
        ecoRunning = null;
    }
  }

function setupCode(){
    clearDebug();
    procsSetting = document.getElementById("numProcs");
    ecoInterp = new Interpreter(editor.getCode(), parseInt(procsSetting.value), ecoLibrary);
    saveCodeAfterSetupButton(editor.getCode(),ecoInterp.valid);
    saveProgram(2); // also save temp for "last saved" access
    if (ecoInterp.valid) {
        procsSetting.disabled = 1;
        var codeWindow = document.getElementById("codeWindow");
        codeWindow.style.background = 'lightyellow';
        editor.disable();
        highlightLine(editor,0,"blue",true,true);
        debug("The code parsed!");
        // enable start, step, stop
        document.getElementById("startButton").disabled="";
        document.getElementById("stepButton").disabled="";
        document.getElementById("setupButton").disabled=true;
        document.getElementById("resetButton").disabled="";
    }
    else {
        highlightLine(editor,ecoInterp.parser.errorLinenumber,"red",true,true);
    }
}

function noEditorEntry(){
    return;
}
function startCode(){
    document.getElementById("runningGif").innerHTML='<img src="running.gif" width="20" />';
    ecoTimestep = document.getElementById("timestep").value;
    if (ecoRunning === null) {
        ecoRunning = setInterval(stepForward,ecoTimestep);
    }
    document.getElementById("stopButton").disabled="";
    document.getElementById("stepButton").disabled=true;
    document.getElementById("startButton").disabled=true;
}

function stopCode(){
    document.getElementById("runningGif").innerHTML='<img src="1x1.gif" width="20" />';
    if (ecoRunning) {
        clearInterval(ecoRunning);
        ecoRunning = null;
        document.getElementById("stopButton").disabled=true;
        document.getElementById("stepButton").disabled="";
        document.getElementById("startButton").disabled="";
    }
}

function stepForward(){
    if (typeof ecoInterp == 'undefined') return;
    if (typeof stepForward.currentLine == 'undefined') {
        stepForward.currentLine = 1;
    }
    
    highlightLine(editor,0,"blue",true,true);
    ecoInterp.step();
    var drawables = ecoInterp.drawables();
    var linesRun = ecoInterp.linesRun();
    if (linesRun[0]==0) {
        stopCode();
        resetAll(false);
        debug("Program finished!");
        highlightLine(editor,0,"blue",true,true);
        return;
    }
    
    clearDrawing();
    for (var i=0; i<drawables.length; ++i) {
        drawCircle(drawables[i].x,drawables[i].y,drawables[i].radius,drawables[i].color);
    }
    
    for (var i=0;i<linesRun.length; ++i) {
        highlightLine(editor,linesRun[i],"green",true,false);
    }
    
    clearDebug();
    debug(ecoInterp);
}

function changeTimestep(){
    ecoTimestep = parseInt(document.getElementById("timestep").value)
    if(ecoRunning) {
        clearInterval(ecoRunning);
        ecoRunning = setInterval(stepForward,ecoTimestep);
    }
}
function highlightLine(editor,line,color,update,delArray){
    if (delArray) editor.clearHighlights();
    editor.highlight(line,color);
}

function saveProgram(saveType){
    // saveType should be 0 to save normally, or 1 to save a temp file (synchronous), 2 to save a temp file (async)
    var loggedInHash = getCookie("loggedIn");
    var username = getCookie("username");
    var filename = "untitled"
    if (saveType == 0) {
        filename = prompt("Please enter a file name to save.", filename);
        if (filename == "" || filename ==null) return;
    }
    escapedCode = escape(editor.getCode());
    escapedCode = escapedCode.replaceAll("+","%2B");
    var url = "../cgi-bin/saveCode.py";
     
    var escapedCodeSet = "escapedCode="+escapedCode+"&username="+username+"&ciphertext="+loggedInHash+"&filename="+filename;
    if (saveType > 0) {
        escapedCodeSet+= "&temp=True";
    }
    if (saveType == 1) synchron = true;
    else synchron = false;
    var xhrArgs = {
        url: url,
        postData: escapedCodeSet,
        handleAs: "text",
        sync: synchron,
        load: function(data) {
            if (saveType == 0)
                alert("Code saved!");
        },
        error: function(error) {
            //We'll 404 in the demo, but that's okay.  We don't have a 'postIt' service on the
            //docs server.
            alert("error:"+error);
        }
    }
    
    //Call the asynchronous xhrPost
    var deferred = dojo.xhrPost(xhrArgs);
}

function saveCodeAfterSetupButton(theCode,setupResult) {
    // save processors and timestep settings
    var processors = document.getElementById("numProcs").value;
    setCookie("processors",processors);
    setCookie("timestep",document.getElementById("timestep").value);
    
    var loggedInHash = getCookie("loggedIn");
    var username = getCookie("username");
    var filename = "untitled"
    escapedCode = escape(theCode);
    escapedCode = escapedCode.replaceAll("+","%2B");
    var url = "../cgi-bin/saveAfterSetupButton.py";
    
    var escapedCodeSet = "escapedCode="+escapedCode+"&username="+username+"&ciphertext="+loggedInHash+"&processors="+processors+"&setupResult="+setupResult;
    var xhrArgs = {
        url: url,
        postData: escapedCodeSet,
        handleAs: "text",
        load: function(data) {
            ;
        },
        error: function(error) {
            //We'll 404 in the demo, but that's okay.  We don't have a 'postIt' service on the
            //docs server.
            alert("error:"+error);
        }
    }
    
    //Call the asynchronous xhrPost
    var deferred = dojo.xhrPost(xhrArgs);
}
function loadProgram(){
    saveProgram(1);
    window.location = "load-file.html";
}
function loadExample(){
    saveProgram(1);
    window.location = "load-examples.html";
}
function deleteFile(filename,fileNum){
    if (confirm("Are you sure you want to delete '"+filename+"'?")) {
        var loggedInHash = getCookie("loggedIn");
        var username = getCookie("username");
        var userValidated = loggedIn(username,loggedInHash);
        if (loggedInHash == "" || !userValidated) { // no user is logged in
            alert("You must log in before loading a file.");
            window.location = mainPageUrl;
        }
        else {
            document.getElementById("loginGreeting").innerHTML=username + 
                ' | <a href="javascript:logout()">logout</a>';
        
            var loggedInHash = getCookie("loggedIn");
            var username = getCookie("username");
            var url = "../cgi-bin/deleteFile.py";
            
            var escapedCodeSet = "username="+username+"&ciphertext="+loggedInHash;
            if (fileNum > 0) escapedCodeSet+="&fileNum="+fileNum.toString();
            //alert(escapedCodeSet);
            var xhrArgs = {
                url: url,
                postData: escapedCodeSet,
                handleAs: "text",
                load: function(data) {
                    window.location = "load-file.html";
                },
                error: function(error) {
                    //We'll 404 in the demo, but that's okay.  We don't have a 'postIt' service on the
                    //docs server.
                    alert("error:"+error);
                }
            }
            
            //Call the asynchronous xhrPost
            var deferred = dojo.xhrPost(xhrArgs);   
        }
    }
}

function getQueryVariable(variable) { 
  var query = window.location.search.substring(1); 
  var vars = query.split("&"); 
  for (var i=0;i<vars.length;i++) { 
    var pair = vars[i].split("="); 
    if (pair[0] == variable) { 
      return pair[1]; 
    } 
  } 
  // not found, return -1
  return -1; 
} 

function about(){
  saveCodeAfterSetupButton(editor.getCode(),1);
  window.location = "about.html";
}

function help(){
  saveCodeAfterSetupButton(editor.getCode(),1);
  window.location = "help.html";
}

function log(msg) {
    setTimeout(function() {
        throw new Error(msg);
    }, 0);
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

