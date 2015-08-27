/**
 * Created by Luther Tychonievich (c) 2011. 
 * Released under a Creative Commons Attribution 3.0 Unported (CC BY 3.0) license.
 * http://creativecommons.org/licenses/by/3.0/
 * 
 * Failing to include attribution to the creator is a violation of the license.
 *
 * Usage: var editorname = new SimpleText(domElementToAddEditorTo);
 * editorname.setCode('text with\n newlines and    spaces, not spacing tags')
 * var text = editorname.getCode();
 * editorname.highlight(linenumber, color);
 * editorname.clearHighlights(); // default
 * editorname.disable();
 * editorname.enable(); // default
 *
 * WARNING: you should include the following CSS rule for IE to display properly:
 * <style type="text/css">table tbody tr td pre p { margin: 0px; }</style>
 */


/*
<div and <p both start lines if not already started
<br ends a line, no matter what
<br><div> = 2 new lines
<br></div> = end a line (only; br does nothing)
Ends a line no matter what: br
Starts a line if a line exists: p div
*/

function escapeToHtml(text){
	return text.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}


function htmlToText(html) {
	parts = html.split(/(<[^>]+>)/);
	var text = "";
	var newline = false;
	for (var i = 0; i < parts.length; ++i) {
		var el = parts[i];
		if (el.length == 0) continue;
		if (el[0] == '<' && el[el.length-1] == '>') {
			if (/^<br[^a-z]/i.test(el)) {
				if (newline && text.length && text[text.length-1] != '\n') text += "\n";
				text += "\n";
				newline = false;
			} else if (/^<(p|div)[^a-z]/i.test(el)) {
				newline = true;
			} else { 
				// garbage tag; ignore it
			}
		} else {
			if (newline && text.length && text[text.length-1] != '\n') {
				text += "\n";
				newline = false;
			}
			text += el;
		}
	}
	text = text.replace(/&nbps;| /gi, ' ');
	text = text.replace(/&gt;/gi,'>').replace(/&lt;/gi,'<').replace(/&amp;/gi,'&');
	text = text.replace(/&nbps;| /gi, ' ');
	text = text.replace(/&[a-z]+;/gi, '');
	if (text[text.length-1] == '\n') text = text.substring(0,text.length-1);
	return text;
}

function SimpleText(appendTo) {
	var cell, row;
	this.textarea = document.createElement('pre');
	this.linenumbers = document.createElement('pre');
	
	this.linenumbers.style.textAlign = 'right';
	this.textarea.owner = this;
	this.textarea.style.minHeight = '1em';
	this.textarea.style.minWidth = '2em';

	cell = document.createElement('td'); cell.appendChild(this.linenumbers);
	cell.style.verticalAlign = 'top';
	row = document.createElement('tr'); row.appendChild(cell);
	cell = document.createElement('td'); cell.appendChild(this.textarea);
	cell.style.width = '100%';
	cell.style.verticalAlign = 'top';
	row.appendChild(cell);
	cell = document.createElement('tbody');
	cell.appendChild(row);
	row = document.createElement('table');
	row.style.width = '100%';
	row.appendChild(cell);
	appendTo.appendChild(row);

	
	var ta = this.textarea;
	var ln = this.linenumbers;
	this.textarea.onkeyup = function(event) {
		if (event && event.currentTarget)
			ta = event.currentTarget;
		if (ta.owner)
			ln = ta.owner.linenumbers
		var text = ta.owner.getCode();
		var bits = text.split('\n').length;
		while (ln.childNodes.length > bits) 
			ln.removeChild(ln.lastChild);
		while (ln.childNodes.length < bits) {
			var div = document.createElement("div");
			div.style.backgroundColor="#EEEEEE";
			div.style.color="#AAAAAA";
			div.appendChild(document.createTextNode(String(ln.childNodes.length+1)));
			ln.appendChild(div);
		}
	}
	this.highlight = function(line, color) {
		this.setCode(this.getCode());
		if (!color) color = '#EEEEEE';
		if (line > 0 && line <= this.linenumbers.childNodes.length)
			this.linenumbers.childNodes[line-1].style.backgroundColor = color;
	}
	this.clearHighlights = function(color) {
		if (!color) color = '#EEEEEE';
		for (var i=0; i<this.linenumbers.childNodes.length; ++i)
			this.linenumbers.childNodes[i].style.backgroundColor = color;
	}
	this.getCode = function() {
		var text = htmlToText(this.textarea.innerHTML);
		return text;
	}
	this.setCode = function(text) {
		// escape text
		text = escapeToHtml(text)
		if (navigator.userAgent.indexOf('IE') >= 0) {
			// IE: <P>line</P>, blank = <P>&nbps;</P>
			text = text.split('\n');
			text = '<P>'+text.join('</P><P>')+'</P>';
			text = text.replace(/<P><\/P>/g, '<P>&nbsp;</P>');
			text = text.replace(/ /g,'&nbsp;');
		} else if (navigator.userAgent.indexOf('Apple') >= 0) {
			// Chrome/Safari: <div>line</div>, blank = <div><br></div>
			text = text.split('\n');
			text = '<div>'+text.join('</div><div>')+'</div>';
			text = text.replace(/<div><\/div>/g, '<div><br></div>');
		} else {
			// Firefox/Opera: <br> between lines, trailing <br>
			text = text.replace(/\n/g,'<br>') + '<br>';
		}
		this.textarea.innerHTML = text;
		this.textarea.onkeyup();
	}
	
	this.enable = function() {
		this.setCode(this.getCode());
		this.textarea.contentEditable = true;
		this.textarea.style.backgroundColor = 'LightYellow';
		this.textarea.style.color = 'Black';
	}
	this.disable = function() {
		this.setCode(this.getCode());
		this.textarea.contentEditable = false;
		this.textarea.style.backgroundColor = 'LightGrey';
		this.textarea.style.color = 'grey';
	}
	this.enable();
	this.setCode('');
}

function SimpleTextNoLineNumbers(appendTo) {
	var cell, row;
	this.textarea = document.createElement('pre');
	this.linenumbers = document.createElement('pre');
	
	this.linenumbers.style.textAlign = 'right';
	this.textarea.owner = this;
	this.textarea.style.minHeight = '1em';
	this.textarea.style.minWidth = '2em';

	cell = document.createElement('td'); //cell.appendChild(this.linenumbers);
	cell.style.verticalAlign = 'top';
	row = document.createElement('tr'); row.appendChild(cell);
	cell = document.createElement('td'); cell.appendChild(this.textarea);
	cell.style.width = '100%';
	cell.style.verticalAlign = 'top';
	row.appendChild(cell);
	cell = document.createElement('tbody');
	cell.appendChild(row);
	row = document.createElement('table');
	row.style.width = '100%';
	row.appendChild(cell);
	appendTo.appendChild(row);
	
	this.resetNewText = function(){
		this.newText = {'loc':0,'text':''};
	}
	this.textarea.onkeypress = function(event) {
		// add key to array, until return, then send
		console.log("keypress");
		var owner = event.currentTarget.owner;
		if (event && event.keyCode != 13 && event.currentTarget) {
			var t = owner.newText['text'];
			var loc = owner.newText['loc'];
			owner.newText['text']=[t.slice(0,loc),String.fromCharCode(event.keyCode),t.slice(loc)].join('');
			owner.newText['loc']+=1;
		}
		else if (event && event.keyCode == 13 && event.currentTarget) { // return key
			// send to gdb as program input
			// just send the new text
			//var ta = event.currentTarget;
			sendGdbMsg('console_command',owner.newText['text'],updateWindows);
			owner.resetNewText;
		}
	}
	this.textarea.onkeydown = function(event) {
		// only allow backspace and left/right arrow keys
		var owner = event.currentTarget.owner;
		
		// up/down
		if (event.keyCode == 38 ||
		    event.keyCode == 40) {
			event.preventDefault();
		}
		else if (event.keyCode == 37) { // left
			if (owner.newText['loc']>0) owner.newText['loc']--;
		}
		else if (event.keyCode == 39) { // right
			if (owner.newText['loc']<owner.newText['text'].length) {
				owner.newText['loc']++;
			}
		}
		else if (event.keyCode == 8) { // backspace
			if (owner.newText['loc'] > 0) {
				var t = owner.newText['text'];
				var loc = owner.newText['loc'];
				owner.newText['text']=[t.slice(0,loc-1),t.slice(loc)].join('');
				owner.newText['loc']--;
			}
			else {
				event.preventDefault(); // don't let the user delete other stuff
			}
		}
		//console.log(event.keyCode);
		
	}
	this.textarea.onmousedown = function(event) {
		// don't let user screw around with the cursor location with the mouse
		event.preventDefault();
	}
	this.getCode = function() {
		var text = htmlToText(this.textarea.innerHTML);
		return text;
	}
	this.setCode = function(text) {
		if (navigator.userAgent.indexOf('IE') >= 0) {
			// IE: <P>line</P>, blank = <P>&nbps;</P>
			text = text.split('\n');
			text = '<P>'+text.join('</P><P>')+'</P>';
			text = text.replace(/<P><\/P>/g, '<P>&nbsp;</P>');
			text = text.replace(/ /g,'&nbsp;');
		} else if (navigator.userAgent.indexOf('Apple') >= 0) {
			// Chrome/Safari: <div>line</div>, blank = <div><br></div>
			text = text.split('\n');
			text = '<div>'+text.join('</div><div>')+'</div>';
			text = text.replace(/<div><\/div>/g, '<div><br></div>');
		} else {
			// Firefox/Opera: <br> between lines, trailing <br>
			text = text.replace(/\n/g,'<br>') + '<br>';
		}
		this.textarea.innerHTML = text;
		//this.textarea.onkeypress();
		this.currentCode=this.getCode();
		this.setEndOfContenteditable(this.textarea);
	}
	this.enable = function() {
		this.setCode(this.getCode());
		this.textarea.contentEditable = true;
		this.textarea.style.backgroundColor = 'LightBlue';
		this.textarea.style.color = 'Black';
	}
	this.disable = function() {
		this.setCode(this.getCode());
		this.textarea.contentEditable = false;
		this.textarea.style.backgroundColor = 'LightGrey';
		this.textarea.style.color = 'grey';
	}
	this.setEndOfContenteditable = function (contentEditableElement)
	{
	    var range,selection;
	    if(document.createRange)//Firefox, Chrome, Opera, Safari, IE 9+
	    {
		range = document.createRange();//Create a range (a range is a like the selection but invisible)
		range.selectNodeContents(contentEditableElement);//Select the entire contents of the element with the range
		range.collapse(false);//collapse the range to the end point. false means collapse to end rather than the start
		selection = window.getSelection();//get the selection object (allows you to change selection)
		selection.removeAllRanges();//remove any selections already made
		selection.addRange(range);//make the range you have just created the visible selection
	    }
	    else if(document.selection)//IE 8 and lower
	    { 
		range = document.body.createTextRange();//Create a range (a range is a like the selection but invisible)
		range.moveToElementText(contentEditableElement);//Select the entire contents of the element with the range
		range.collapse(false);//collapse the range to the end point. false means collapse to end rather than the start
		range.select();//Select the range (make it the visible selection
	    }
	}

	this.enable();
	this.setCode('');
	this.resetNewText();
}