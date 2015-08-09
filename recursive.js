/**
 * Created by Luther Tychonievich (c) 2010,2011. 
 * Released under a Creative Commons Attribution 3.0 Unported (CC BY 3.0) license.
 * http://creativecommons.org/licenses/by/3.0/
 * 
 * Failing to include attribution to the creator is a violation of the license.
 *
 * This is an evolving and undocumented language designed for teaching programming.
 * I intend to add documentation once the language stablizes
 */
 
var ecosimWidth = 1000;
var ecosimHeight = 500;

/// Takes a regex or string and returns a regex that only matches entire strings
function regexglobal(r) {
	if (typeof r == 'string') {
		r = r.replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&");
		r = RegExp(r,"i");
	}
	var s = r.source;
	s = "^"+s+"$";
	s = s.replace(/^\^\^+/,"^");
	s = s.replace(/([^\\])[$]+$/,"$1$$");
	var extra = "";
	if (r.global) extra += "g";
	if (r.multiline) extra += "m";
	if (r.ignoreCase) extra += "i";
	return RegExp(s, extra);
}
function isempty(obj) {
	for (var dummy in obj) { return false; }
	return true;
}
function debug() {
	var i;
	if (document && document.getElementById("debugwindow")) { // for nice browser page
		var writeto = document.getElementById("debugwindow");
		for (i=0; i<arguments.length; ++i) {
			writeto.appendChild(document.createTextNode(strobj(arguments[i])));
			writeto.appendChild(document.createElement("br"));
		}
	} else if (alert) { // for annoying browser interrupt
		var alertstring = "DEBUG\n";
		for (i=0; i<arguments.length; ++i) {
			alertstring += "  "+strobj(arguments[i]) + "\n";
		}
		alert(alertstring);
	}
}
function clearDebug() {
	try {
		var debug = document.getElementById("debugwindow");
		while (debug.hasChildNodes()) debug.removeChild(debug.lastChild);
	} catch (E) {}
}
/// Pretty-print any object
function strobj(k) {
	var ans;
	if (k === null) return 'null';
	if (k === undefined) return 'undefined';
	if (typeof(k) == 'object') {
		if (k && 'length' in k) {
			ans = "[ ";
			for (var i=0; i<k.length; ++i) {
				if (typeof(k[i]) != 'function')
					ans += strobj(k[i])+",";
			}
			return ans.substring(0,ans.length-1)+" ]";
		}
		if (k && String(k.toString).indexOf('native code') == -1) return k.toString();
		ans = "{ ";
		for (var e in k) {
			if (typeof(k[e]) != 'function')
				ans += String(e)+":"+strobj(k[e])+",";
		}
		return ans.substring(0,ans.length-1)+" }";
	} else { return String(k); }
}


/*
expression: {type:'string', op:'name', range:[idx0, idx1], ...}
	op:'literal', val:3
	op:'colorstring', val:"css color name"
	op:'+', lhs:#expr, #rhs:#expr
	op:'negate', expr:#expr
	op:'variable', kind:name|type, name:'x', idx:null|number, scope:#locals
	op:'field', kind:name|type, name:'stuff', idx:null|number, owner:#expr
	op:'property', name:'stuff', owner:#expr, body:#expr
	op:'fieldset', kind:name|type, name:'x', count:number, owner:#expr
	op:'typeset', scope:#locals
	
typebits: {type:'string', op:field|property, count:number, range:[num,num], ...}
	op:'field', kind:name|type, name:'x'
	op:'property', name:'x', body:#expr
type: {'name':#typebit, ... }

local: {type:'str', name:'x', range:[idx0, idx1]}

statement: {op:'name', range:[idx0, idx1], ...}
	op:'create', num:#expr, type:type
	op:':=', lhs:#expr,  rhs:#expr
	op:'for', num:#expr, body:#statement
	op:'while', guard:#expr, body:#statement
	op:'iterate', collection:#expr, body:#statement
	op:'if', guard:#expr, body:#statement
	op:'inorder', list:[#stmt, #stmt, ...]
	op:'outoforder', list:[#stmt, #stmt, ...]
	op:'iterate', collection:#expr, body:#stmt, scope:#locals
	op:'procedurecall, args:[null|#expr, ...], procedure:#procedure

toplevel: {op:'name', range:[idx0, idx1], ...}
	// any statement, or
	op:'timed', seconds:number, body:#stmt
	op:'bored', body:#stmt
	op:'propdef', type:name, name:name, body:#expr
	op:'procdef', parsekey:['#type'|'word', ...], body:#stmt
	op:'collision', t1:#type, t2:#type, body:body
	// TODO: when the user presses the #key key
	// TODO: when the user left|right clicks on nothing|#type
*/

function Parser(text, library) {
	
	if (!library) {
		library = (
			"a position has\n" +
			"  x, a number\n" +
			"  y, a number\n" +
			"how to move a position a number up\n" +
			"  replace the position's y with the position's old y + the number\n" +
			"how to move a position a number down\n" +
			"  replace the position's y with the position's old y - the number\n" +
			"how to move a position a number right\n" +
			"  replace the position's x with the position's old x + the number\n" +
			"how to move a position a number left\n" +
			"  replace the position's x with the position's old x - the number\n"
		);
	}
	
	this.archiveRanges = function(node) {
		if (node && 'range' in node) {
			node.range[0] = (-1-node.range[0]);
			node.range[1] = (-1-node.range[1]);
		}
		for (var element in node)
			if (node[element] && typeof(node[element]) == 'object')
				this.archiveRanges(node[element]);
	}
	
	// handle a block of text, erasing the ranges from previous blocks
	this.handleText = function(text) {
//		text = text.replace(/[ \t\n\r]+\n/, '\n');
		if (this.s) {
			this.lib_s = this.s;
			this.lib_index = this.index;
			this.lib_idlvl = this.idlvl;
			this.lib_inputtext = this.inputtext;
			this.archiveRanges(this.ast);
		}
		
		this.i = 0;
		this.s = [];
		this.idlvl = [];
		this.index = [];
		this.inputtext = text;
		this.reported = false;
		this.ordered = true;
		this.mustbeold = null;
		this.needset = false;

		var indent = (/^[ \t]*/.exec(text)[0].length/2)|0;
		var tokenizer = /([a-z]+)|([0-9]+(?:\.[0-9]+)?)|([<>]=?|!=|[/+\-*×(),:=])|([\n\r\t ]*\n[ \t]*)|('s)|(#[A-Fa-z0-9]{6})/igm;
		var token;
		while ((token = tokenizer.exec(text))) {
			if (token[1]) { // [a-z]+
				this.s.push(token[1].toLowerCase());
				this.idlvl.push(indent);
				this.index.push(token.index);
			} else if (token[2]) { // [0-9]+(?:\.[0-9]+)?
				this.s.push(token[2]);
				this.idlvl.push(indent);
				this.index.push(token.index);
			} else if (token[3]) { // [\<\>=>]+|[/+\-*(),:]
				this.s.push(token[3]);
				this.idlvl.push(indent);
				this.index.push(token.index);
			} else if (token[4]) { // \n[ \t]*
				this.s.push(';');
				this.idlvl.push(indent);
				this.index.push(token.index);
				token = token[4].split('\n');
				token = token[token.length-1];
				indent = Math.floor(token.length/2);
			} else if (token[5]) { // 's
				this.s.push(token[5].toLowerCase());
				this.idlvl.push(indent);
				this.index.push(token.index);
			} else if (token[6]) { // #xxxxxx
				this.s.push(token[6].toUpperCase());
				this.idlvl.push(indent);
				this.index.push(token.index);
			}
		}
		for (var i=1; i<this.index.length; ++i) {
			var gapstart = this.index[i-1]+this.s[i-1].length;
			var gaplength = this.index[i]-gapstart;
			var sym = this.inputtext.substr(gapstart, gaplength).replace(/\s+/gmi,'')
			if ( '' != sym ) {
				this.error('Unexpected symbol "'+sym+'"; ignoring it', i-1,i+1);
				this.reported = false;
			}
		}
		this.index.push(text.length);
		this.s.push(';');
		this.idlvl.push(0);
		var ans = this.parse();
		if (ans === null) this.ast = null;
	}
	
	// ======================= Begin setup ==========================
	this.error = function(m,oi,ni) {
		if (!this.reported) {
			var charidx = [this.index[oi], this.index[ni]];
			this.errorLinenumber = this.inputtext.substring(0, this.index[ni]).split('\n').length
			// TODO: use the character indexes in front end
			//debug("ERROR: line number "+this.errorLinenumber,this.inputtext.slice(charidx[0], charidx[1]), m);
			debug("ERROR: line number "+this.errorLinenumber,m);
		}
		this.reported = true;
	}

	
	this.ast = [];
	this.typedefs = {'number':{}, 'comparison':{}, 'color':{}, };
//		'position':{
//			'x':{type:'number', op:'field', count:null, range:[0,0], kind:'name', name:'x'},
//			'y':{type:'number', op:'field', count:null, range:[0,0], kind:'name', name:'y'}
//		}
//	};
	this.locals = { 'steps':{op:'literal', type:'number', val:3 } }; // 3 kinds: #oldscope:{...}, $typename:3, varname:expression
	this.procedures = {};
	this.specialwords = {};
	var tmp = 'as with is if in start replace create destroy do one a an the two no none zero three four five six seven eight nine ten first second third fourth fifth sixth seventh eighth ninth tenth then repeat has when bored seconds every any order long times old'.split(" ");
	this.allcolors = "AliceBlue AntiqueWhite Aqua Aquamarine Azure Beige Bisque Black BlanchedAlmond Blue BlueViolet Brown BurlyWood CadetBlue Chartreuse Chocolate Coral CornflowerBlue Cornsilk Crimson Cyan DarkBlue DarkCyan DarkGoldenRod DarkGray DarkGrey DarkGreen DarkKhaki DarkMagenta DarkOliveGreen Darkorange DarkOrchid DarkRed DarkSalmon DarkSeaGreen DarkSlateBlue DarkSlateGray DarkSlateGrey DarkTurquoise DarkViolet DeepPink DeepSkyBlue DimGray DimGrey DodgerBlue FireBrick FloralWhite ForestGreen Fuchsia Gainsboro GhostWhite Gold GoldenRod Gray Grey Green GreenYellow HoneyDew HotPink IndianRed Indigo Ivory Khaki Lavender LavenderBlush LawnGreen LemonChiffon LightBlue LightCoral LightCyan LightGoldenRodYellow LightGray LightGrey LightGreen LightPink LightSalmon LightSeaGreen LightSkyBlue LightSlateGray LightSlateGrey LightSteelBlue LightYellow Lime LimeGreen Linen Magenta Maroon MediumAquaMarine MediumBlue MediumOrchid MediumPurple MediumSeaGreen MediumSlateBlue MediumSpringGreen MediumTurquoise MediumVioletRed MidnightBlue MintCream MistyRose Moccasin NavajoWhite Navy OldLace Olive OliveDrab Orange OrangeRed Orchid PaleGoldenRod PaleGreen PaleTurquoise PaleVioletRed PapayaWhip PeachPuff Peru Pink Plum PowderBlue Purple Red RosyBrown RoyalBlue SaddleBrown Salmon SandyBrown SeaGreen SeaShell Sienna Silver SkyBlue SlateBlue SlateGray SlateGrey Snow SpringGreen SteelBlue Tan Teal Thistle Tomato Turquoise Violet Wheat White WhiteSmoke Yellow YellowGreen".toLowerCase().split(" ");
	this.keycodes = {
		"backspace":8, "tab":9, "enter":13, "shift":16, "ctrl":17, "alt":18,
		"pause":19, "capslock":20, "escape":27,
		"pageup":33, "pagedown":34, "end":35, "home":36,
		"left":37, "up":38, "right":39, "down":40,
		"insert":45, "delete":46,
		"0":48, "1":49, "2":50, "3":51, "4":52, "5":53, "6":54, "7":55, "8":56, "9":57, 
		"a":65, "b":66, "c":67, "d":68, "e":69, "f":70, "g":71, "h":72, "i":73,
		"j":74, "k":75, "l":76, "m":77, "n":78, "o":79, "p":80, "q":81, "r":82,
		"s":83, "t":84, "u":85, "v":86, "w":87, "x":88, "y":89, "z":90,
		"leftwindow":91, "rightwindow":92, "select":93,
		"num0":96, "num1":97, "num2":98, "num3":99, "num4":100,
		"num5":101, "num6":102, "num7":103, "num8":104, "num9":105,
		"multiply":106, "add":107, "subtract":109,
		"decimal":110, "divide":111,
		"f1":112, "f2":113, "f3":114, "f4":115, "f5":116, "f6":117,
		"f7":118, "f8":119, "f9":120, "f10":121, "f11":122, "f12":123,
		"numlock":144, "scrolllock":145,
		"semicolon":186, "equal":187, "comma":188, "hyphen":189, "period":190,
		"slash":191,
		"grave":192,
		"open":219,
		"backslash":220,
		"close":221,
		"quote":222
	};

	for (i in tmp) { this.specialwords[tmp[i]] = i; }
	for (i in this.allcolors) { this.specialwords[this.allcolors[i]] = i; }
	// ======================== End setup ===========================
	

	// ====================== Begin misc toolkit ======================
	this.declaration = function(id) {
		var scope = this.locals;
		while (true) {
			if (id in scope) { return scope; }
			else if ('#oldscope' in scope) { scope = scope['#oldscope']; }
			else break;
		}
		if (id in this.typedefs) { return '#type'; }
		return null;
	}
	this.top = function() { 
		var idx = this.i;
		if (arguments.length == 1) 
			idx += arguments[0];
		if (idx >= this.s.length) return ";";
		return this.s[idx];
	}
	this.topindent = function() { 
		var idx = this.i;
		if (arguments.length == 1) 
			idx += arguments[0];
		if (idx >= this.idlvl.length) return 0;
		return this.idlvl[idx];
	}
	this.expect = function(pattern) {
		if (typeof pattern == 'string' && pattern == 'a') { pattern = /^an?$/; }
		if (this.top().match(regexglobal(pattern))) { this.i += 1; return this.top(-1); }
		return null;
	}
	this.eol = function(oldi) {
		if (this.expect(';') != ";") { 
			this.error('Expected a new line before "'+this.top()+'"', this.oldi, this.i);
			this.i = oldi; 
			return null; 
		}
		return true;
	}
	this.scopelookup = function(id,scope) {
		while (true) {
			if (id in scope) { return scope[id]; }
			else if ('#oldscope' in scope) { scope = scope['#oldscope']; }
			else break;
		}
		return null;
	}
	this.similar = function(exp1, exp2) {
		if (exp1 === null || exp2 === null) {
			return exp1 == exp2;
		}
		if (exp1.op != exp2.op) return false;
		switch(exp1.op) {
			case 'literal':  return exp1.val == exp2.val;
			case 'negate':   return this.similar(exp1.expr, exp2.expr);
			case 'variable': 
				if (exp1.idx != exp2.idx) return false;
				if (exp1.kind != exp2.kind) return false;
				if (exp1.kind == 'type') return exp1.name == exp2.name;
				return this.scopelookup(exp1.name,exp1.scope).name == this.scopelookup(exp2.name,exp2.scope).name;
			case 'field':    return exp1.name == exp2.name && exp1.idx == exp2.idx && this.similar(exp1.owner, exp2.owner);
			case 'property': return exp1.name == exp2.name && this.similar(exp1.owner, exp2.owner);
			case 'fieldset': return exp1.name == exp2.name && this.similar(exp1.owner, exp2.owner);
			case 'typeset':  return exp1.name == exp2.name;
			default: // binary
				return this.similar(exp1.lhs, exp2.lhs) && this.similar(exp1.rhs, exp2.rhs);
		}
	}
	this.needold = function(astnode) {
		// if no old is needed, return null
		// if old needed, return token it is needed in front of (always only 1 such token)
		if (this.mustbeold === null) { 
			return null;
		}
		switch(this.mustbeold.op) {
			case 'variable':
				if (astnode !== null) return null;
				return [this.mustbeold.idx, this.mustbeold.name];
			case 'field':
				if (!this.similar(this.mustbeold.owner, astnode)) return null;
				return [this.mustbeold.idx, this.mustbeold.name];
			default:
				debug("this.mustbeold.op = "+this.mustbeold.op);
				return null;
		}
		return null;
	}
	// ======================= End misc toolkit =======================
	
	// recursive descent:
	this.parse = function() {
		var ans = []
		var idx = 0;
		var oidx = 0;
		while (this.i < this.s.length && this.expect(';')) {} // blank lines OK
		while (this.i < this.s.length) {
			var node = this.toplvl();
			if (node === null) { 
				if (!this.reported) this.error("Can't understand line begining \""+this.top()+"\" (a typo?)",oidx,this.i+1);
				return null; 
			}
			oidx = idx;
			idx = this.i;
			ans.push(node);
			while (this.i < this.s.length && this.expect(';')) {} // blank lines OK
		}
		if (ans !== null) this.ast = this.ast.concat(ans);
		return ans;
	}
	this.toplvl = function() {
		var oldi = this.i;
		var oldindent = this.topindent();
//debug(oldindent, this.top());
		var node = this.newtype()
			|| this.proceduredef()
			|| this.property()
			|| this.bored()
			|| this.collision()
			|| this.keylistener()
			|| this.statement()
			;
		if (oldindent > 0) {
			if (this.reported) {
				debug('Or maybe the indentation is wrong?');
			} else {
				this.error('The indentation of this line doesn\'t make sense', oldi, this.i);
			}
			this.i = oldi;
			return null;
		}
		return node;
	}
	
	// ===================== Begin Toplevel Only =========================
	this.property = function() {
		// a #type 's weight is #expression
		var oldi = this.i;
		if (this.expect(/an?/) === null) { this.i = oldi; return null; }
		var t = this.oldtype();
		if (t === null) { this.i = oldi; return null; }
		if (this.expect("'s") === null) { this.i = oldi; return null; }
		var key = this.wordglob();
		if (key === null) { 
			this.error("Needed at least one word after \"'s\"", oldi, this.i);
			this.i = oldi; return null;
		}
		if (this.expect("is") === null) {
			this.error('Expected "is" or another word, not "'+this.top()+'"', oldi, this.i);
			this.i = oldi; return null;
		}
		if (key in this.typedefs[t]) {
			this.error("Sorry, "+t+" already has its "+key+" defined", oldi, this.i);
			this.i = oldi; return null;
		}
		/// Optional newline/indent
		if (this.expect(";") == ';') { // doesn't matter if it fails
			if (this.topindent(-2) >= this.topindent(0)) { 
				this.error('"'+this.s.slice(oldi,this.i-1).join(" ")+'" ought to be followed by a computation or value', oldi, this.i);
				this.i = oldi; return null; 
			}
		}
		this.locals = {'#oldscope':this.locals};
		this.locals['$'+t] = 1;
		var value = this.expr();
		this.locals = this.locals['#oldscope'];
		if (value === null) {
				this.error('"A [type]\'s [thing] is" must be followed by a value or computation', oldi, this.i);
				this.i = oldi; return null;
		}
		var newbit = {type:value.type, op:'property', name:key, body:value, range:[oldi, this.i]};
		this.typedefs[t][key] = newbit;
		return {op:'propdef', type:value.type, name:key, body:value, range:[oldi, this.i]};
	}
	this.bored = function() {
		var oldi = this.i;
		if (this.expect("when") === null) { this.i = oldi; return null; }
		if (this.expect("bored") === null) { this.i = oldi; return null; }
		var body = this.onestmt();
		if (body === null) { this.i = oldi; return null; }
		return {op:'bored', body:body, range:[oldi, this.i]};
	}
	this.keylistener = function() {
		var oldi = this.i;
		if (this.expect("when") === null) { this.i = oldi; return null; }
		if (this.expect("the") === null) { this.i = oldi; return null; }
		var keyname = this.expect(/[a-z]+/);
		if (keyname === null) {
			keyname = this.expect(/[0-9]/);
			if (keyname === null) { 
				this.error('"when the" should be followed by a key name', oldi, this.i); 
				this.i = oldi; return null; 
			}
		}
		if (keyname == 'num') { keyname += this.expect(/[0-9]/); }
		if ( !(keyname in this.keycodes) ) {
			this.error('"when the" should be followed by a key name', oldi, this.i); 
			this.i = oldi; return null; 
		}
		if (this.expect("key") === null) { 
			this.error('Expected "key" after "'+keyname+'"', oldi, this.i); 
			this.i = oldi; return null; 
		}
		if (this.expect("is") === null) { 
			this.error('Expected "is" after "key"', oldi, this.i); 
			this.i = oldi; return null; 
		}
		if (this.expect("typed") === null) { 
			this.error('Expected "typed" after "is"', oldi, this.i); 
			this.i = oldi; return null; 
		}
		var body = this.onestmt();
		if (body === null) { this.i = oldi; return null; }
		return {op:'keypress', key:this.keycodes[keyname], body:body, range:[oldi, this.i]};
	}
	this.collision = function() {
		var oldi = this.i;
		if (this.expect("when") === null) { this.i = oldi; return null; }
		this.expect(/an?/); // optional, ignore errors
		var t1 = this.oldtype();
		if (t1 === null) { this.i = oldi; return null; }
		if (this.expect("hits") === null) { this.i = oldi; return null; }
		this.expect(/an?/); // optional, ignore errors
		var t2 = this.oldtype();
		if (t2 === null) { 
			this.error('Need another type after "hits"', oldi, this.i);
			this.i = oldi; return null; 
		}
		if (!('size' in this.typedefs[t1]) || (this.typedefs[t1].size.type != 'number')
		||  !('position' in this.typedefs[t1])
		||  !('size' in this.typedefs[t2]) || (this.typedefs[t2].size.type != 'number')
		||  !('position' in this.typedefs[t2]) ) {
			this.error('Collisions only happen between things with both a number named "size" and a position');
			this.i = oldi; return null;
		}
		this.locals = {'#oldscope':this.locals};
		this.locals['$'+t1] = 1;
		if (t1 == t2) this.locals['$'+t2] = 2;
		else this.locals['$'+t2] = 1;
		var body = this.onestmt();
		this.locals = this.locals['#oldscope'];
		if (body === null) { this.i = oldi; return null; }
		return {op:'collision', t1:t1, t2:t2, body:body, range:[oldi, this.i]};
	}
	this.proceduredef = function() {
		// how to #word et cetera:
		var oldi = this.i;
		if (this.expect("how") === null) { this.i = oldi; return null; }
		if (this.expect("to") === null) { this.i = oldi; return null; }
		var parsekey = [];
		var count = 0;
		var newlocals = {'#oldscope':this.locals};
		while (this.top() != ':' && this.top() != ';') {
			var thing;
			if ((thing = this.oldtype()) !== null) {
				if (count == 0) {
					this.error('Didn\'t expect a plain "'+thing+'" in a "how to"; did you mean "a '+thing+'"?', oldi, this.i);
					this.i = oldi; return null;
				} 
				if ('$'+thing in newlocals) { newlocals['$'+thing] += count; }
				else { newlocals['$'+thing] = count; }
				for ( ; count > 0; --count) {
					parsekey.push('#'+thing);
				}
			} else if ((thing = this.wholenum()) !== null) {
				if (count != 0) {
					this.error('Expected a type name after "'+this.top(-2)+'", not "'+this.top(-1)+'"', oldi, this.i);
					this.i = oldi; return null;
				}
				count = thing;
			} else if ((thing = this.expect(/[a-zA-Z]+/)) !== null) { // TODO: add 'filler' type
				if (count != 0) {
					this.error('Expected a type name after "'+this.top(-2)+'", not "'+this.top(-1)+'"', oldi, this.i);
					this.i = oldi; return null;
				}
				parsekey.push(thing);
			} else {
				this.error('A "'+this.top()+'" doesn\'t make sense in a "how to" line', oldi, this.i);
				this.i = oldi; return null;
			}
		}
		if (count != 0) {
			this.error('"how to" shouldn\'t end with a nuber', oldi, this.i);
			this.i = oldi; return null;
		}
		if (parsekey.length == 0) {
			this.error('"how to" must be followed by at least one word', oldi, this.i);
			this.i = oldi; return null;
		}
		if (typeof parsekey[0] != 'string' || parsekey[0][0] == '#') {
			this.error('"how to" must be followed by an unused word, not "'+parsekey[0]+'"', oldi, this.i);
			this.i = oldi; return null;
		}
		this.expect(":"); // ignore failure
		this.locals = newlocals;
		var body = this.onestmt(this.topindent(-1));
		this.locals = this.locals['#oldscope'];
		if (body === null) { 
			this.error('"how to" must be followed by at least one action', oldi, this.i);
			this.i = oldi; return null; 
		}
		if (parsekey in this.procedures) {
			this.error('You already told me how to do this earlier', oldi, this.i);
			this.i = oldi; return null;
		}
		this.procedures[parsekey] = { op:'procdef', parsekey:parsekey, body:body, range:[oldi, this.i] };
		return this.procedures[parsekey];
		
	}
	// ====================== End Toplevel Only ==========================

	// ======================= Begin statements ==========================
	this.onestmt = function(indent) {
		// [;] #statement
		var oldi = this.i;
		this.expect(":")
		if (this.expect(";") !== null) { // doesn't matter if it fails
			if (this.topindent(-2) >= this.topindent(0)) { 
				this.error("Expected an action (in line or indented on next line)", oldi, this.i); 
				this.i = oldi; return null; 
			}
		} else {
			this.error('Expected a new indented line between "'+this.s[oldi-1]+'" and "'+this.s[oldi]+'"', oldi-1, this.i+1); 
			this.i = oldi; return null; 
		}
		var oldorder = this.ordered;
		this.ordered = false;
		var block = this.statement();
		this.ordered = oldorder;
		if (block === null) { 
			this.error("Expected an action, not \""+this.top()+"\"", oldi, this.i); 
			this.i = oldi; return null; 
		}
		return block;
	}
	this.statement = function() {
		return this.doblock()
			|| this.ifthen()
			|| this.whileloop()
			|| this.countloop()
			|| this.iterloop()
			|| this.pickrandom()
			|| this.startas()
			|| this.referto()
			|| this.replacewith()
			|| this.create()
			|| this.destroy()
			|| this.procedurecall()
			;
	}
	this.procedurecall = function() {
		var oldi = this.i;
		var calldetails = [];
		var callsig = [];this
		while (this.top() != ';') {
			var thing;
			if ((thing = this.expr()) !== null) {
				callsig.push('#'+thing.type);
				calldetails.push(thing);
				this.expect(',');
				this.expect('and');
			} else if ((thing = this.expect(/[a-zA-Z]+/)) !== null) {
				callsig.push(thing);
				calldetails.push(null);
			} else {
				this.i = oldi; return null;
			}
		}
		if (callsig in this.procedures) {
//debug("procedure call",callsig,this.procedures[callsig]);
			return { op:'procedurecall', args:calldetails, procedure:this.procedures[callsig], range:[oldi, this.i] };
		} else {
			this.i = oldi; return null;
		}
	}
	this.stmtlist = function(indent) {
		if (this.topindent() != indent)
			return [];
		var oldi = this.i;
		var ans = [];
		while (this.topindent() == indent) {
			if (this.topindent() != indent) break;
			var bit = this.statement();
			if (bit === null) { 
				this.error("Expected an action; was this a typo?", oldi, this.i); 
				this.i = oldi; return null; 
			}
			this.expect(';');
			ans.push(bit);
		}
		return ans;
	}
	this.doblock = function() {
		// do in [any] order
		var oldi = this.i;
		this.expect("do"); // optional
		var atomic = this.expect('atomically') !== null;
		if (this.expect("in") === null) { this.i = oldi; return null; }
		var type = 'inorder';
		if (this.expect("any") !== null) { type = 'outoforder'; }
		if (type == 'outoforder' && atomic) {
			this.error('you can only put "atomically" with "in order"', oldi, this.i);
			this.i = oldi; return null;
		}
		if (this.expect("order") === null) { this.i = oldi; return null; }
		if (!atomic) atomic = this.expect('atomically') !== null;
		this.expect(":"); // ignore failures
		if (this.eol(oldi) === null) return null;
		// save and initialize scope
		var oldorder = this.ordered;
		if (type == 'inorder') {
			this.ordered = true;
			this.locals = {'#oldscope':this.locals};
		} else {
			this.ordered = false;
		}
		// do body
		var body = this.stmtlist(Math.max(this.topindent(), this.topindent(-1)+1));
		// restore old scope
		this.ordered = oldorder;
		if (type == 'inorder') {
			this.locals = this.locals['#oldscope'];
		} 
		// etc
		if (body === null) { this.i = oldi; return null; }
		if (body.length == 0) {
			this.error('Invalid "in [any] order": needs at least one indented action', oldi, this.i);
			this.i = oldi; return null; 
		}
		return {op:type, list:body, atomic:atomic, range:[oldi, this.i]};
	}
	this.ifthen = function() {
		// if #comparison [;] then #onestmt
		var oldi = this.i;
		var indentation = this.topindent();
		if (this.expect("if") === null) { this.i = oldi; return null; }
		var guard = this.typeexpr("comparison");
		if (guard === null) { 
			this.error('"if" should be followed by a comparison', oldi, this.i); 
			this.i = oldi; return null; }
		this.expect("then"); // ignore failures
		this.expect(":"); // ignore failures
		var body = this.onestmt();
		if (body === null) { this.i = oldi; return null; }
		this.expect(';');
		if (this.topindent() == indentation && this.expect('otherwise') !== null) {
			var obody = this.onestmt();
			if (obody === null) { this.i = oldi; return null; }
			return {op:'if', guard:guard, body:body, obody:obody, range:[oldi, this.i]};
		}
		return {op:'if', guard:guard, body:body, obody:null, range:[oldi, this.i]};
	}
	this.whileloop = function() {
		// as long as #boolean [;] repeat #onestmt
		var oldi = this.i;
		if (this.expect("as") === null 
		||  this.expect("long") === null
		||  this.expect("as") === null
		) { this.i = oldi; return null; }
		var guard = this.typeexpr("comparison");
		if (guard === null) { 
			this.error('"as long as" should be followed by a comparison',oldi, this.i);
			this.i = oldi; return null; }
		this.expect("repeat"); // ignore failures
		this.expect(":"); // ignore failures
		var body = this.onestmt();
		if (body === null) { this.i = oldi; return null; }
		return {op:'while', guard:guard, body:body, range:[oldi, this.i]};
	}
	this.countloop = function() {
		// repeat #number times: #onestmt
		var oldi = this.i;
		if (this.expect("repeat") === null) { this.i = oldi; return null; }
		var number = this.typeexpr('number');
		if (number === null) { 
			this.error('"repeat" should be followed by a number',oldi, this.i);
			this.i = oldi; return null; }
		if (this.expect("times") === null) { 
			this.error('"repeat (number)" should be followed by "times"',oldi, this.i);
			this.i = oldi; return null; }
		this.expect(":"); // ignore failures
		var body = this.onestmt();
		if (body === null) { this.i = oldi; return null; }
		return {op:'for', num:number, body:body, range:[oldi, this.i]};
	}
	this.iterloop = function() {
		// for each|every|all #collection: #onestmt	(with it, possibly "the #type" bound)
		var oldi = this.i;
		if (this.expect("for") === null) { this.i = oldi; return null; }
		if (this.expect(/^each|every|all$/) === null) { this.i = oldi; return null; }
		var collection = this.collection();
		if (collection === null) {
			this.error("Expected either a type or a group of things, not \""+this.top()+"\"", oldi, this.i);
			this.i = oldi; return null;
		}
		this.expect(":"); // ignore failures
		var scope = {'#oldscope':this.locals};
		scope['$'+collection.type] = 1;
		this.locals = scope;
		var body = this.onestmt();
		this.locals = this.locals['#oldscope'];
		if (body === null) { this.i = oldi; return null; }
		return {op:'iterate', collection:collection, body:body, scope:scope, range:[oldi, this.i]};
	}
	this.pickrandom = function() {
		// for each|every|all #collection: #onestmt	(with it, possibly "the #type" bound)
		var oldi = this.i;
		if (this.expect("for") === null) { this.i = oldi; return null; }
		if (this.expect("some") === null) { this.i = oldi; return null; }
		var collection = this.collection();
		if (collection === null) {
			this.error("Expected either a type or a group of things, not \""+this.top()+"\"", oldi, this.i);
			this.i = oldi; return null;
		}
		this.expect(":"); // ignore failures
		var scope = {'#oldscope':this.locals};
		scope['$'+collection.type] = 1;
		this.locals = scope;
		var body = this.onestmt();
		this.locals = this.locals['#oldscope'];
		if (body === null) { this.i = oldi; return null; }
		return {op:'select', collection:collection, body:body, scope:scope, range:[oldi, this.i]};
	}

	this.replacewith = function() {
		// replace #oldvar with #qualified(oldvar)expr
		var oldi = this.i;
		if (this.expect("replace") === null) { this.i = oldi; return null; }
		var lhs = this.expr();
		if (lhs === null || !this.assignable) { 
			this.error('"replace" ought to be followed by something you can change', oldi, this.i);
			this.i = oldi; 
			return null; 
		}
		if (this.expect("with") === null) {
			this.error('"replace [thing]" ought to be followed by "with", not "'+this.top()+'"', oldi, this.i);
			this.i = oldi;
			return null;
		}
		this.mustbeold = lhs;
		var expr = this.typeexpr(lhs.type);
		this.mustbeold = null;
		if (expr === null) {
			this.error('"replace '+this.s.slice(oldi+1,this.i-1).join(" ")+' with" ought to be followed by a computation or value of type "'+lhs.type+'"', oldi, this.i);
			this.i = oldi;
			return null;
		}
		return {op:":=", lhs:lhs, rhs:expr, range:[oldi, this.i]};
	 }
	this.startas = function() {
		// start #newvar as #expr
		var oldi = this.i;
		if (this.expect("start") === null) { this.i = oldi; return null; }
		var name = this.newid();
		//var name = this.wordglob();
		if (name === null) { 
			this.error('"start" ought to be followed by a new name, not "'+this.top()+'"', oldi, this.i);
			this.i = oldi; 
			return null; 
		}
		if (name in this.typedefs || this.declaration(name)) {
			this.error('"start" ought to be followed by a new name, not "'+name+'"', oldi, this.i);
			this.i = oldi; 
			return null; 
		}
		if (this.expect("as") === null) {
			this.error('"start '+name+'" ought to be followed by "as", not "'+this.top()+'"', oldi, this.i);
			this.i = oldi;
			return null;
		}
		if (!this.ordered) {
			this.error('"start [variable] as [value]" not allowed in unordered statements', oldi, this.i);
			this.i = oldi;
			return null;
		}
		var expr = this.expr();
		if (expr === null) {
			this.error('"start '+name+' as" ought to be followed by a computation or value', oldi, this.i);
			this.i = oldi;
			return null;
		}
		if (expr.type != 'number' && expr.type != 'color' && expr.type != 'comparison') {
			this.error('"start '+name+' as" only works for basic types. Did you mean "refer to '+this.codestring(expr)+' as '+name+'"?', oldi, this.i);
			this.i = oldi;
			return null;
		}
		this.locals[name] = {type:expr.type, name:name, range:[oldi+1,oldi+2]};
		var lhs = {type:expr.type, op:'variable', kind:'name', name:name, idx:null, scope:this.locals, range:[oldi+1,oldi+2]};
		return {op:':=', lhs:lhs, rhs:expr, range:[oldi, this.i]};
	}
	this.referto = function() {
		// refer to #expr as #newvar
		var oldi = this.i;
		if (this.expect("refer") === null) { this.i = oldi; return null; }
		if (this.expect("to") === null) { this.i = oldi; return null; }

		var expr = this.expr();
		if (expr === null) {
			this.error('"refer to" ought to be followed by a computation or value', oldi, this.i);
			this.i = oldi; return null;
		}
		if (expr.type == 'number' || expr.type == 'color' || expr.type == 'comparison') {
			this.error('"refer to" only works for object types. Did you mean "start (name) as '+this.codestring(expr)+'"?', oldi, this.i);
			this.i = oldi; return null;
		}
		
		if (this.expect("as") === null) {
			this.error('"refer to '+this.codestring(expr)+'" ought to be followed by "as", not "'+this.top()+'"', oldi, this.i);
			this.i = oldi; return null;
		}
		var name = this.newid();
		if (name === null) { 
			this.error('"refer to '+this.codestring(expr)+' as" ought to be followed by a new name, not "'+this.top()+'"', oldi, this.i);
			this.i = oldi; return null; 
		}
		if (name in this.typedefs || this.declaration(name)) {
			this.error('"refer to '+this.codestring(expr)+' as" ought to be followed by a new name, not "'+this.top()+'"', oldi, this.i);
			this.i = oldi; return null; 
		}
		if (!this.ordered) {
			this.error('"refer to [value] as [name]" not allowed in unordered statements', oldi, this.i);
			this.i = oldi; return null;
		}
		this.locals[name] = {type:expr.type, name:name, range:[oldi+1,oldi+2]};
		var lhs = {type:expr.type, op:'variable', kind:'name', name:name, idx:null, scope:this.locals, range:[oldi+1,oldi+2]};
		return {op:':=', lhs:lhs, rhs:expr, range:[oldi, this.i]};
	}
	this.create = function() {
		// create #number? #type
		var oldi = this.i;
		if (this.expect(/^create$/i) === null)
			return null;
		var num = this.typeexpr("number");
		if (num === null) {
			this.error('"create" needs a numer"', oldi, this.i);
			this.i = oldi;
			return null;
		}
		var type = this.oldtype();
		if (type === null) {
			this.error('Invalid "create": ought to be "create [number] [type]"', oldi, this.i);
			this.i = oldi;
			return null;
		}
		if (this.expect("and")) { // initializer
			if (!this.expect("for")) { this.error('expected "for" after "and"'); this.i = olid; return null; }
			if (!this.expect("each")) { this.error('expected "each" after "for"'); this.i = olid; return null; }
			this.expect(":"); // ignore failures
			var scope = {'#oldscope':this.locals};
			scope['$'+type] = 1;
			this.locals = scope;
			var body = this.onestmt();
			this.locals = this.locals['#oldscope'];
			if (body === null) { this.i = oldi; return null; }
			return {op:'create', type:type, num:num, body:body, range:[oldi, this.i]};
		}
		return {op:'create', type:type, num:num, body:null, range:[oldi, this.i]};
	}
	this.destroy = function() {
		// destroy the [count] #type
		var oldi = this.i;
		if (this.expect(/^destroy$/i) === null)
			return null;
		var target = this.variable();
		if (target === null) {
			this.error('"destroy" must be followed by a thing to destroy',oldi, this.i);
			this.i = oldi; return null;
		}
		if (target.kind != 'type') {
			this.error('You cannot destroy named values like "'+target.name+'"',oldi, this.i);
			this.i = oldi; return null;
		}
		return {op:'destroy', target:target, range:[oldi, this.i]};
	}
	// ======================== End statements ===========================
	
	// ====================== Begin expressions ==========================
	this.expr = function() {
		return this.binary()
			|| this.unary()
			|| this.randomnum()
			|| this.baseexpr()
			;
	}
	this.baseexpr = function() {
		var front = this.literal()
			|| this.colorname()
			|| this.variable()
			|| this.parenthesis()
			;
		if (front !== null) {
			front = this.possessives( front );
		}
		return front; 
	}
	this.unary = function() {
		var oldi = this.i;
		var op = this.expect('-');
		if (op === null) { this.i = oldi; return null; } 
		var expr = this.baseexpr();
		if (expr === null || expr.type != 'number') { this.i = oldi; return null; } 
		this.assignable = false;
		return {type:'number', op:"negate", expr:expr, range:[oldi, this.i]};
	}
	this.parenthesis = function() {
		var oldi = this.i;
		if ( this.expect("(") != "(" ) { this.i = oldi; return null; }
		var expr = this.expr();
		if (expr === null) { this.i = oldi; return null; } 
		if ( this.expect(")") != ")" ) { this.i = oldi; return null; }
		return expr;
	}
	this.binary = function() { // for now, no logical operations
		var oldi = this.i;
		var lhs = this.baseexpr();
		if (lhs === null) { this.i = oldi; return null; }
		var op = this.expect(/^([<>]=?|=)$/);
		var otype = "comparison";
		if (op === null) { 
			op = this.expect(/^[/+\-*x÷×]$/);
			if (op === null) { this.i = oldi; return null; }
			otype = "number";
		}
		var rhs = this.baseexpr();
		if (rhs === null) { 
			this.error('Operator "'+op+'" should have been followed by another number, not to a "'+this.top()+'"', oldi, this.i);
			this.i = oldi; return null; 
		}
		if (otype == 'comparison') {
			if (lhs.type != rhs.type || (rhs.type != 'number' && rhs.type != 'color')) {
				this.error('Operator "'+op+'" must be applied to 2 numbers or colors, not to a '+lhs.type+' and a '+rhs.type, oldi, this.i);
				this.i = oldi;
				return null;
			}
		} else if (lhs.type != 'number' || rhs.type != 'number') {
			this.error('Operator "'+op+'" must be applied to 2 numbers, not to a '+lhs.type+' and a '+rhs.type, oldi, this.i);
			this.i = oldi;
			return null;
		}
		this.assignable = false;
		return {type:otype, op:op, lhs:lhs, rhs:rhs, range:[oldi, this.i]};
	}
	this.literal = function() {
		var oldi = this.i;
		var ans = this.number();
		if (ans === null) {
			if (this.expect("+") == "+") {
				ans = this.number();
				if (ans === null) { this.i = oldi; return null; }
			} else if (this.expect("-") == "-") {
				ans = this.number();
				if (ans === null) { this.i = oldi; return null; }
				ans = -ans;
			} else { return null; }
		}
		this.assignable = false;
		return {type:"number", op:'literal', val:ans, range:[oldi, this.i]};
	}
	this.colorname = function() {
		var oldi = this.i;
		var ans = this.expect(/#[0-9A-Fa-f]{6}/);
		if (ans !== null) {
			return {type:'color', op:'colorname', val:ans, range:[oldi, this.i]};
		}
		ans = this.expect(/[a-z]+/i);
		if (ans !== null)
			for (var i = 0; i < this.allcolors.length; ++i)
				if (ans.toLowerCase() == this.allcolors[i].toLowerCase())
					return {type:'color', op:'colorname', val:ans, range:[oldi, this.i]};
		this.i = oldi;
		return null;
	}
	this.variable = function() {
		var oldi = this.i;
		var oldbefore = this.needold(null);
		var gotold;
		if (this.expect("the") !== null) {
			gotold = this.expect("old");
			var idx = this.ordinal();
			var type = this.oldtype();
			if (type === null) { this.i = oldi; return null; }
			if (gotold === null && oldbefore !== null && oldbefore[0] == idx && oldbefore[1] == type) {
				this.error('You probably need to add "old" between "the" and "'+this.s[oldi+1]+'"', oldi, this.i)
				this.i = oldi; return null;
			}
			if (gotold && !(oldbefore !== null && oldbefore[0] == idx && oldbefore[1] == type)) {
				this.error('You can\'t have an "old" between "the" and "'+this.s[oldi+2]+'"', oldi, this.i)
				this.i = oldi; return null;
			}
			var maxindex = this.scopelookup('$'+type, this.locals);
			if (maxindex === null) {
				this.error('You can\'t access specific unnamed "'+type+'"s here', oldi, this.i)
				this.i = oldi; return null;
			}
			if ( (idx !== null) && (maxindex == 1) ) {
				this.error('There is only one "'+type+'" here.', oldi, this.i)
				this.i = oldi; return null;
			}
			if (idx >= maxindex) {
				this.error('There are only '+maxindex+' "'+type+'"s here', oldi, this.i)
				this.i = oldi; return null;
			}
			if ( (idx === null) && (maxindex != 1) ) {
				this.error('There are '+maxindex+' "'+type+'"s here; which one do you want?', oldi, this.i)
				this.i = oldi; return null;
			}
			this.assignable = true;
			return {type:type, op:'variable', kind:'type', name:type, idx:idx, scope:this.locals, range:[oldi, this.i]};
		} else {
			gotold = this.expect("old");
			//var key = this.wordglob();
			var key = this.expect(/[a-z]+/);
			var scope = this.declaration(key);
			if (scope === null || scope == '#type') { this.i = oldi; return null; }
			if (gotold === null && oldbefore !== null && oldbefore[0] === null && oldbefore[1] == key) {
				this.error('You probably need to add "old" before "'+key+'"', oldi, this.i)
				this.i = oldi; return null;
			}
			if (gotold && !(oldbefore !== null && oldbefore[0] === null && oldbefore[1] == key)) {
				this.error('You can\'t have an "old" before "'+key+'"', oldi, this.i)
				this.i = oldi; return null;
			}
			this.assignable = true;
			return {type:scope[key].type, op:'variable', kind:'name', name:key, idx:null, scope:scope, range:[oldi, this.i]};
		}
	}
	this.possessives = function(base) {
		var oldi = this.i;
		while (this.expect("'s") !== null) {
			// [thing] 's (old)? (ordinal)? field
			// [thing] 's (old)? property
			if (base.op == 'fieldset') {
				this.error('Which of the '+base.count+' "'+base.name+'"s in a "'+base.owner.type+'" did you want to use "\'s" on?', oldi, this.i);
				this.i = oldi; return null;
			}
			if (!(base.type in this.typedefs)) {
				this.error("You can't use \"'s\" on a "+base.type, oldi, this.i);
				this.i = oldi;
				return null;
			}
			var oldbefore = this.needold(base);
			var gotold = this.expect("old");
			var idx = this.ordinal();
			var key = this.wordglob();
			if (key === null) {
				this.error("Expected a word after \"'s\"", oldi, this.i);
				this.i = oldi;
				return null;
			}
			while ( key.length > this.top(-1).length && !(key in this.typedefs[base.type]) ) {
				this.i -= 1;
				key = key.substring(0, key.length - this.top().length - 1);
			}
			if (!(key in this.typedefs[base.type])) {
				this.error('There is no "'+key+'" in a "'+base.type+'"', oldi, this.i);
				this.i = oldi;
				return null;
			}
			if (oldbefore !== null && idx == oldbefore[0] && key == oldbefore[1]) {
				if (gotold === null) {
					this.error('You probably needed an "old" here', oldi, this.i)
					this.i = oldi; return null;
				}
			} else if (gotold !== null) {
				this.error('You can\'t have an "old" here', oldi, this.i)
				this.i = oldi; return null;
			}
			var bit = this.typedefs[base.type][key];
			if (bit.op == 'field') {
				if(idx !== null) {
					if (bit.count == 1) {
						this.error('There is only one "'+key+'" in a "'+base.type+'"', oldi, this.i);
						this.i = oldi; return null;
					}
					if (bit.count <= idx) {
						this.error('There are only '+bit.count+' "'+key+'"s in a "'+base.type+'"', oldi, this.i);
						this.i = oldi; return null;
					}
					this.assignable = true;
					base = {type:bit.type, op:'field', kind:bit.kind, name:key, idx:idx, owner:base, range:[oldi, this.i]};
				} else if (bit.count > 1) {
					base = {type:bit.type, op:'fieldset', kind:bit.kind, name:key, count:bit.count, owner:base, range:[oldi, this.i]};
				} else {
					this.assignable = true;
					base = {type:bit.type, op:'field', kind:bit.kind, name:key, idx:idx, owner:base, range:[oldi, this.i]};
				}
			} else if (bit.op == 'property') {
				if (idx !== null) {
					this.error('There is only one "'+key+'" in a "'+base.type+'"', oldi, this.i);
					this.i = oldi; return null;
				}
				this.assignable=false;
				base = {type:bit.type, op:'property', name:key, owner:base, range:[oldi, this.i], body:bit.body};
			} else {
				debug("Internal error: type had a part that was neither property nor field", this.pretty(bit));
			}
		}
		if (this.needset && base.op != 'fieldset') {
			// this.error("Needed a set of things, but given just one unique thing.", oldi, this.i);
			this.i = oldi; return null;
		}
		if (base.op == 'fieldset' && !this.needset) {
			this.error('Which of the '+base.count+' "'+base.name+'"s in a "'+base.owner.type+'" did you want?', oldi, this.i);
			this.i = oldi; return null;
		}
		return base;
	}
	this.typeexpr = function(type,noerror) {
		var oldi = this.i;
		var ans = this.expr();
		if (ans === null) {
			if (!noerror) 
				this.error('Expected a '+type+' but none found', oldi, this.i-1);
			return null;
		}
		if (ans.type == type) return ans;
		if (!noerror)
			this.error('Expression "'+this.s.slice(oldi, this.i).join(' ')+'" is a "'+ans.type+'"; you needed a "'+type+'"', oldi, this.i-1);
		this.i = oldi; 
		return null; 
	}
	this.collection = function() {
		var oldi = this.i;
		var type = this.oldtype();
		if (type !== null) {
			return {type:type, op:'typeset', kind:'type', scope:this.locals, range:[oldi, this.i]};
		}
		this.needset = true;
		var expr = this.baseexpr();
		this.needset = false;
		if (expr === null) { this.i = oldi; return null; }
		return expr;
	}
	this.randomnum = function() {
		var oldi = this.i;
		if (this.expect("a") === null) { this.i = oldi; return null; }
		if (this.expect("random") === null) { this.i = oldi; return null; }
		if (this.expect("number") === null) { this.i = oldi; return null; }
		if (this.expect("between") === null) {
			this.error('"a random number" must be followed by "between" and two numbers', oldi, this.i);
			this.i = oldi; return null;
		}
		var n1 = this.typeexpr('number');
		if (n1 === null) { return null; }
		if (this.expect("and") === null) {
			this.error('need an "and" after the first number for random numbers', oldi, this.i);
			this.i = oldi; return null;
		}
		var n2 = this.typeexpr('number');
		if (n1 === null) { return null; }
		return { op:'random', type:'number', n1:n1, n2:n2, range:[oldi, this.i] };
	}
	// ====================== End expressions ============================

	// =================== Begin Special Tokens =======================
	this.newid = function() {
		var got = this.expect(/[a-z]+/);
		if (got === null) return null;
		if (got in this.typedefs
		||  this.declaration(got) !== null
		||  got in this.specialwords
		) {
			this.i -= 1;
			return null;
		}
		return got;
	}
	this.nontype = function() {
		var got = this.expect(/[a-z]+/);
		if (got === null) return null;
		if (got in this.typedefs) {
			this.i -= 1;
			return null;
		} else {
			return got;
		}
	}
	this.oldtype = function() {
		var got = this.expect(/[a-z]+/);
		if (got === null) return null;
		if (got in this.typedefs) {
			return got;
		} else {
			this.i -= 1;
			return null;
		}
	}
	this.wordglob = function() {
		var pname = []
		while (!(this.top() in this.specialwords)) {
			var word = this.expect(/[a-z]+/);
			if (word === null) { break; }
			pname.push(word);
		}
		if (pname.length == 0) return null;
		return pname.join(" ");
	}
	this.ordinal = function() {
		var oldi = this.i;
		if (this.top().match(/^[0-9]+(\.[0-9]+)?$/)) {
			this.i += 1;
			var p1 = Number(this.top(-1));
			if (this.expect(/st|rd|nd|th/) !== null) {
				return p1-1;
			} else { return null; }
		} else {
			switch (this.top()) {
				case "first":  this.i += 1; return 0;
				case "second": this.i += 1; return 1;
				case "third":  this.i += 1; return 2;
				case "fourth": this.i += 1; return 3;
				case "fifth":  this.i += 1; return 4;
				case "sixth":  this.i += 1; return 5;
				case "seventh":this.i += 1; return 6;
				case "eighth": this.i += 1; return 7;
				case "ninth":  this.i += 1; return 8;
				case "tenth":  this.i += 1; return 9;
				default: return null;
			}
		}
	}
	this.number = function() {
		if (this.top().match(/^[0-9]+(\.[0-9]+)?$/)) {
			this.i += 1;
			return Number(this.top(-1));
		} else {
			switch (this.top()) {
				case "zero": case "none": case "no": this.i += 1; return 0;
				case "one":  case "a":    case "an": this.i += 1; return 1;
				case "two":   this.i += 1; return 2;
				case "three": this.i += 1; return 3;
				case "four":  this.i += 1; return 4;
				case "five":  this.i += 1; return 5;
				case "six":   this.i += 1; return 6;
				case "seven": this.i += 1; return 7;
				case "eight": this.i += 1; return 8;
				case "nine":  this.i += 1; return 9;
				case "ten":   this.i += 1; return 10;
				default: return null;
			}
		}
	}
	this.naturalnum = function() {
		var oldi = this.i;
		var ans = this.number();
		if (ans === null) { this.i = oldi; return null; }
		if (ans != Math.floor(ans) || ans < 0) { this.i = oldi; return null; }
		return ans;
	}
	this.wholenum = function() {
		var oldi = this.i;
		var ans = this.number();
		if (ans === null) { this.i = oldi; return null; }
		if (ans != Math.floor(ans) || ans <= 0) { this.i = oldi; return null; }
		return ans;
	}
	// =================== End Special Tokens =======================
	
	// =========== Begin "a [newname] has [things]" ==================
	this.newtype = function() {
		var oldi = this.i;
		var indent = this.topindent();
		if (this.expect("a") === null) return null;
		var tname = this.newid();
		if (tname === null) { this.i = oldi; return null; }
		if (this.expect("has") === null) { this.i = oldi; return null; }
		this.expect(':');
		if (this.eol(oldi) === null) return null;
		var newindent = this.topindent();
		if (newindent <= indent) {
			this.error('Invalid "a '+tname+' has": ought to be followed by an indented set of pieces', oldi, this.i);
			this.i = oldi; return null; 
		}
		var parts = this.typebits(newindent);
		if (parts === null) { this.i = oldi; return null; }
		if (isempty(parts)) { 
			this.error('Invalid "a '+tname+' has": ought to be followed by an indented set of pieces', oldi, this.i);
			this.i = oldi; return null; 
		}
		if (tname in parts) {
			this.error('A "'+tname+'" cannot contain another "'+tname+'"', oldi, parts[tname].range[1]);
			this.i = oldi; return null; 
		}
		this.typedefs[tname] = parts;
		var copy = {};
		for (var key in parts) { copy[key] = parts[key]; }
		return {op:'newtype', name:tname, bits:copy, range:[oldi, this.i]};
	}
	this.typebits = function(indent) {
		var oldi = this.i;
		var ans = {};
		while (this.topindent() == indent) {
			var bit = this.numtype()
				|| this.nametype()
				;
			if (bit === null) { 
				this.error('Type descriptions must be "[number] [type]" or "[name], a [type]"', oldi, this.i); 
				this.toplvl();
				this.i = oldi; return null; 
			}
			if (bit.name in ans) {
				this.error('A type description may only have one "'+bit.name+'"', oldi, this.i); 
				this.i = oldi; return null; 
			}
			ans[bit.name] = bit;
			if (this.eol(oldi) === null) {
				this.error('Expected a the line to end before "'+this.top()+'"', oldi, this.i); 
				this.i = oldi; return null; 
			}
		}
		return ans;
	}
	this.numtype = function() {
		var oldi = this.i;
		var num = this.wholenum();
		if (num === null || typeof num != "number") { this.i = oldi; return null; }
		var type = this.oldtype();
		if (type === null) { this.i = oldi; return null; }
		return {type:type, op:'field', count:num, kind:'type', name:type, range:[oldi, this.i]};
	}
	this.nametype = function() {
		var oldi = this.i;
		var name = this.nontype();
		if (name === null) { this.i = oldi; return null; }
		if (this.expect(",") === null) { this.i = oldi; return null; }
		var anon = this.numtype();
		if (anon === null) { this.i = oldi; return null; }
		return {type:anon.type, op:'field', count:anon.count, kind:'name', name:name, range:[oldi, this.i]};
	}
	// =================== End "a [newname] has [things] ================
	
	this.pretty = function (ast) {
		if (ast === null) return "null";
		var ans = "";
		if (typeof ast == 'object') {
			if ('0' in ast) { // an array
				ans += "[ ";
				for (var i =0; i<ast.length; ++i) {
					ans += this.pretty(ast[i])+" ";
				}
				ans += "]";
			} else { // an object
				ans += "{ ";
				for (var k in ast) {
					if (k == 'range') {
						ans += '"'+this.inputtext.substring(this.index[ast[k][0]], this.index[ast[k][1]])+'"';
					} else if (k == 'scope') {
					} else if (k == 'procedure') {
						ans += k+":"+this.pretty(ast[k].parsekey)+" ";
					} else {
						ans += k+":"+this.pretty(ast[k])+" ";
					}
				}
				ans += "}";
			}
		} else {
			ans += ast;
		}
		return ans;
	}
	this.lineof = function(ast) {
		if (ast && 'ast' in ast) return this.lineof(ast.ast);
		if (!ast || !('range' in ast) || ast.range[0] < 0) return 0;
		var pretext = this.inputtext.slice(0,this.index[ast.range[0]]);
		return pretext.split('\n').length;
	}
	this.codestring = function(ast) {
		if (ast && 'ast' in ast) return this.codestring(ast.ast);
		if (!ast || !('range' in ast)) return 'nothing';
		if (ast.range[0] < 0) {
			var charidx = [this.lib_index[-1-ast.range[0]], this.lib_index[-1-ast.range[1]]];
			return '[built-in] '+this.lib_inputtext.slice(charidx[0], charidx[1]);
		} else {
			var charidx = [this.index[ast.range[0]], this.index[ast.range[1]]];
			return this.inputtext.slice(charidx[0], charidx[1]);
		}
	}
	this.oneline = function(ast) {
		if (ast && 'ast' in ast) return this.oneline(ast.ast);
		if (!ast || !('range' in ast)) return 'nothing';
		var ans = '';
		if (ast.range[0] < 0) {
			ans = this.lib_s.slice(-1-ast.range[0], -1-ast.range[1]).join(" ");
		} else {
			ans = this.s.slice(ast.range[0], ast.range[1]).join(" ");
		}
		ans = ans.replace(" 's","'s");
		if (ans == ';') return 'nothing';
		return ans.split(' ;')[0]+" (line "+this.lineof(ast)+")";
	}
	
	if (library) this.handleText(library);
	this.handleText(text);
}








// assignment
function lvalueset(node, value, scope) {
	if (scope) rvalue.scope = scope;
	switch(node.op) {
		case 'variable': 
			if (node.kind == 'name') {
				var container = scopelookupref(node.name, rvalue.scope);
				if (container) container[node.name] = value; // replace with
				else rvalue.scope[node.name] = value; // start as
			} else { // node.kind == 'type', like 'the 1st number'
				scopelookup('$'+node.name, rvalue.scope)[Number(node.idx)] = value;
			}
			break;
		case 'field':
			if (node.kind == 'name' && node.name == 'x' && node.owner.type == 'position')
				value = Math.max(Math.min(value,ecosimWidth), 0);
			if (node.kind == 'name' && node.name == 'y' && node.owner.type == 'position')
				value = Math.max(Math.min(value,ecosimHeight), 0);
			if (node.kind == 'name') {
				rvalue(node.owner, rvalue.scope)[node.name][Number(node.idx)] = value;
			} else { // node.kind == 'type', like 'the 1st number'
				rvalue(node.owner, rvalue.scope)['$'+node.name][Number(node.idx)] = value;
			}
			var top = node.owner;
			while ('owner' in top) top = top.owner;
			rvalue(top, rvalue.scope)['%dirty'] = true;
			break;
		default:
			debug("Unexpected lvalue expression ",node);
	}
}




function rvalue(node, scope) {
	var ans, owner;
	if (scope) rvalue.scope = scope;
	if ('owner' in node) {
		owner = rvalue(node.owner);
		if (!owner) return ans;
	}
	switch(node.op) {
		case 'colorname': ans = node.val; break;
		case 'literal': ans = node.val; break;
		case '+': 
			ans = rvalue(node.lhs) + rvalue(node.rhs);
			break;
		case '-': 
			ans = rvalue(node.lhs) - rvalue(node.rhs);
			break;
		case 'x': case '×': case '*': 
			ans = rvalue(node.lhs) * rvalue(node.rhs);
			break;
		case '/': case '÷':
			ans = rvalue(node.lhs) / rvalue(node.rhs);
			break;
		case '<':
			ans = rvalue(node.lhs) < rvalue(node.rhs);
			break;
		case '>':
			ans = rvalue(node.lhs) > rvalue(node.rhs);
			break;
		case '<=':
			ans = rvalue(node.lhs) <= rvalue(node.rhs);
			break;
		case '>=':
			ans = rvalue(node.lhs) >= rvalue(node.rhs);
			break;
		case '=': case '==':
//			if (node.lhs.type == 'number') {
//				ans = Math.abs(rvalue(node.lhs) - rvalue(node.rhs)) < 0.00001;
//			} else {
				ans = rvalue(node.lhs) == rvalue(node.rhs);
//			}
			break;
		case 'negate': 
			ans = -rvalue(node.expr); 
			break;
		case 'variable': 
			if (node.kind == 'name') {
				ans = scopelookup(node.name, rvalue.scope);
			} else { // node.kind == 'type', like 'the 1st number'
				ans = scopelookup('$'+node.name, rvalue.scope)[Number(node.idx)];
			}
			break;
		case 'field':
			if (node.kind == 'name') {
				ans = owner[node.name][Number(node.idx)];
			} else { // node.kind == 'type', like 'the 1st number'
				ans = owner['$'+node.name][Number(node.idx)];
			}
			break;
		case 'property':
			var newscope = {'#oldscope':rvalue.scope};
			newscope['$'+node.owner.type] = [owner];
			ans = rvalue(node.body, newscope);
			rvalue.scope = newscope['#oldscope'];
			break;
		case 'fieldset':
			ans = owner[node.name];
			// op:'fieldset', kind:name|type, name:'x', count:number, owner:#expr
			break;
		case 'typeset': 
			// op:'typeset', scope:#locals
			ans = scopelookup('$'+node.type, rvalue.scope);
			break;
		case 'random':
			// op:'random', n1:#expr, n2:#expr
			var n1 = rvalue(node.n1);
			var n2 = rvalue(node.n2);
			ans = Math.random()*Math.abs(n2-n1) + Math.min(n1,n2);
			break;
		default:
			debug("Unexpected expression ",node);
			ans = null;
	}
	return ans;
}

function scopelookup(id,scope) {
	// scope example: {'red':3, 'dog':{'x':[2,3],'$number':[2]}, '$number':[3]}
	while (true) {
		if (id in scope) { return scope[id]; }
		else if ('#oldscope' in scope) { scope = scope['#oldscope']; }
		else break;
	}
	return null;
}
function scopelookupref(id,scope) {
	// scope example: {'red':3, 'dog':{'x':[2,3],'$number':[2]}, '$number':[3]}
	while (true) {
		if (id in scope) { return scope; }
		else if ('#oldscope' in scope) { scope = scope['#oldscope']; }
		else break;
	}
	return null;
}





function Interpreter(text, processors, library) {
	if (library)
		this.parser = new Parser(text,library);
	else
		this.parser = new Parser(text);
	if (this.parser.ast == null) this.valid = false;
	else this.valid = true;

	this.init = [];
	this.collisions = [];
	this.bored = [];
	this.keylisteners = {};
	for (var i=0; this.parser.ast && i<this.parser.ast.length; ++i) {
		var toplevel = this.parser.ast[i];
		switch (toplevel.op) {
			case "newtype": case "propdef": case "procdef": break;
			case "bored": this.bored.push(toplevel.body); break;
			case "collision": this.collisions.push(toplevel); break;
			case "create": case ":=": case "for": case "while": case "iterate": 
			case "if": case "inorder": case "outoforder": case "procedurecall": 
			case "select":
				this.init.push(toplevel); break;
			case 'keypress':
				if (toplevel.key in this.keylisteners) {
					this.keylisteners[toplevel.key].push(toplevel.body);
				} else {
					this.keylisteners[toplevel.key] = [toplevel.body];
				}
				break;
			default: 
				debug("Unimplemented operator",toplevel);
		}
	}
	this.globals = { 'steps':0 };
	this.workset = [{ast:{op:'#stmtlist', list:this.init, range:[0,this.parser.i]},scope:this.globals}];
	for (var n in this.parser.typedefs) {
		this.globals['$'+n] = Array(0);
	}
	this.procs = new Array(processors);
	this.delay = new Array(processors);
	for (i = 0; i < this.procs.length; ++i) this.procs[i] = null;
	for (i = 0; i < this.procs.length; ++i) this.delay[i] = 0;
	
	this.makeone = function(typename, defnum) {
		if (typename == 'number') return (defnum === undefined ? (0|(Math.random()*99))+1 : defnum);
		else if (typename == 'comparison') return false;
		else if (typename == 'color') return 'black';
		else if (typename == 'position') return {'x':[(Math.random()*ecosimWidth)|0],'y':[(Math.random()*ecosimHeight)|0]};
		else {
			var template = this.parser.typedefs[typename];
			var ans = {};
			for (var elem in template) {
				if (template[elem].op == 'field') {
					var front = (template[elem].kind == 'type')?'$':'';
					ans[front+elem] = [];
					for (var i=0; i<template[elem].count; ++i) {
						ans[front+elem].push(this.makeone(template[elem].type, defnum));
					}
				}
			}
			return ans;
		}
	}
	
	this.makelist = function(basenode, index, replacement) {
		var ans = { ast:{op:basenode.ast.op, range:basenode.ast.range, list:[]}, scope:basenode.scope };
		for (var i=0; i<basenode.ast.list.length; ++i) {
			if (i == index) { if (replacement) ans.ast.list.push(replacement); }
			else ans.ast.list.push(basenode.ast.list[i]);
		}
		if (ans.ast.list.length == 0) return null;
		if (ans.ast.list.length == 1) ans.ast = ans.ast.list[0];
		return ans;
	}
	
	this.execute = function(item, whom, atomic) {
		if (!item) return null;
		var ast = item.ast;
		if (!ast) return null;
		if ('ast' in ast) return this.execute(ast,whom,atomic);
		if (ast.range[0] >= 0 && !atomic) this.procs[whom] = item;
		var scope = item.scope;
		var leftover = null;
		var i;
		switch(ast.op) {
			case '#stmtlist':
				leftover = this.execute({ast:ast.list[0], scope:scope}, whom, atomic);
				leftover = this.makelist(item, 0, leftover);
				break;
			case 'inorder':
				return this.execute( 
					{ 
						ast:{ op:'#stmtlist', list:ast.list, range:ast.range }, 
						scope:{ '#oldscope':scope } 
					}
					, whom
					, atomic||ast.atomic
				);
				break;
			case 'outoforder':
				var which = (Math.random()*ast.list.length)|0;
				leftover = this.execute({ast:ast.list[which], scope:scope}, whom, atomic||ast.atomic);
				leftover = this.makelist(item, which, leftover);
				break
			case 'create':
				// op:'create', num:#expr, type:#typename, body:#stmt
				var count = rvalue(ast.num, scope);
				if (count && ast.body) {
					leftover = {op:'outoforder', range:ast.body.range, list:[], atomic:atomic};
					for (i = 0; i < count; ++i) {
						var newobject = this.makeone(ast.type, 0);
						this.globals['$'+ast.type].push(newobject)
						var newscope = {'#oldscope':scope};
						newscope['$'+ast.type] = [newobject];
						leftover.list.push( {ast:ast.body, scope:newscope} );
					} 
					leftover = {ast:leftover, scope:scope};
				} else {
					for (i=0; i<count; ++i)
						this.globals['$'+ast.type].push(this.makeone(ast.type))
				}
				break;
			case 'destroy':
				// op:'destroy', target:#expr
				var remove = rvalue(ast.target, scope);
				for (i=0; i<this.globals['$'+ast.target.type].length; ++i) {
					if (this.globals['$'+ast.target.type][i] == remove) {
						this.globals['$'+ast.target.type].splice(i,1);
						--i;
					}
				}
				break;
			case ":=": 
				// op:':=', lhs:#expr, rhs:#expr
				lvalueset(ast.lhs, rvalue(ast.rhs, scope));
				break;
			case "for": 
				// op:'for', num:#expr, body:#statement
				var repititions = rvalue(ast.num, scope);
				if (repititions <= 0) break;
				leftover = {ast:{op:'outoforder', list:[], range:ast.body.range}, scope:scope, atomic:atomic};
				for ( ; repititions>0; --repititions) { leftover.ast.list.push(ast.body); }
				break;
			case "if": 
				// op:'if', guard:#expr, body:#statement
				var guard = rvalue(ast.guard, scope);
				if (guard) { leftover = { ast:ast.body, scope:scope }; }
				else if (ast.obody) { leftover = { ast:ast.obody, scope:scope }; }
				break;
			case "while": 
				// op:'while', guard:#expr, body:#statement
				var guard = rvalue(ast.guard, scope);
				if (guard) { leftover = { ast:{op:'inorder', list:[ast.body, ast], range:ast.range}, scope:scope}; }
				break;
			case "procedurecall": 
				// op:'procedurecall', args:[null|#expr, ...], procedure:#procedure
				var newscope = {'#oldscope':scope};
				for (i=0; i<ast.args.length; ++i) {
					if (ast.args[i]) {
						if (!(('$'+ast.args[i].type) in newscope)) {
							newscope['$'+ast.args[i].type] = [];
						}
						newscope['$'+ast.args[i].type].push(rvalue(ast.args[i], scope));
					}
				}
				leftover = {ast:ast.procedure.body, scope:newscope};
				break;
			case "iterate": 
				// op:'iterate', collection:#expression, body:#statement
				var values = rvalue(ast.collection, scope);
				if (values.length == 0) break;
				leftover = {op:'outoforder', range:ast.body.range, list:[], atomic:atomic};
				for (i = 0; i < values.length; ++i) {
					var newscope = {'#oldscope':scope};
					newscope['$'+ast.collection.type] = [values[i]];
					leftover.list.push( {ast:ast.body, scope:newscope} );
				} 
				leftover = {ast:leftover, scope:scope};
				break;
			case "select": 
				// op:'select', collection:#expression, body:#statement
				var values = rvalue(ast.collection, scope);
				if (values.length == 0) break;
				var newscope = {'#oldscope':scope};
				newscope['$'+ast.collection.type] = [values[(Math.random()*values.length)|0]];
				leftover = { ast:ast.body, scope:newscope };
				break;
			default:
				debug("TODO: implement opcode "+ast.op, ast);
		}
		while (leftover && 'ast' in leftover && 'ast' in leftover.ast) leftover = leftover.ast;
		if (leftover && (leftover.ast.range[0] < 0 || atomic)) {
			if (atomic) this.delay[whom] += 1;
			return this.execute(leftover, whom, atomic);
		} else
			return leftover;
	}

	this.flatten = function(item) {
		if ('ast' in item) { 
			// nested scoped statements can be collapsed
			item.ast = this.flatten(item.ast); 
			if ('ast' in item.ast) item = this.flatten(item.ast);
		} else {
			// 1-length lists can be replaced with their contents
			if ('list' in item && item.list.length == 1 && !item.atomic) item = this.flatten(item.list[0]);
		}
		return item;
	}
	this.worksetstr = function() {
		var ans = '';
		for (var i=0; i<this.workset.length; ++i) {
			ans += '\n'+i+': '+this.workset[i].ast.op;
			if (this.workset[i].ast.list) {
				ans += ' (';
				for (var j=0; j<this.workset[i].ast.list.length; ++j) {
					var item = this.workset[i].ast.list[j];
					while ('ast' in item) item = item.ast;
					ans += ' '+i+':'+item.op;
				}
				ans += ' )';
			}
		}
		return ans;
	}
	
	this.extract = function(owner, type, name, scope) {
		if (typeof(owner) != 'object' || owner === null) return null;
		if (!scope) scope = this.globals;
		if (type[0] == '$') type = type.substring(1);
		var ans;
		if (name in owner) {
			ans = owner[name];
		} else {
			var newscope = {'#oldscope':scope};
			newscope['$'+type] = [owner];
			if (!(name in this.parser.typedefs[type] && 'body' in this.parser.typedefs[type][name]))
				ans = null; 
			else {
				ans = rvalue(this.parser.typedefs[type][name].body, newscope);
			}
		}
		while (typeof(ans) == 'object' && ans && 0 in ans) ans = ans[0];
		if (ans === null && name[0] != '$') ans = this.extract(owner, type, '$'+name, scope);
		return ans;
	}

	this.collisionfinder = function() {
		var queue = [];
		var p1,s1,p2,s2;
		for (var i=0; i<this.collisions.length; ++i) {
			var handle = this.collisions[i];
			for (var i1=0; i1<this.globals['$'+handle.t1].length; ++i1) {
				var a1 = this.globals['$'+handle.t1][i1];
				p1 = this.extract(a1,handle.t1,'$position', this.globals);
				s1 = this.extract(a1,handle.t1,'size', this.globals);
				var i2 = 0;
				if (handle.t1 == handle.t2) i2 = i1+1;
				for ( ; i2<this.globals['$'+handle.t2].length; ++i2) {
					var a2 = this.globals['$'+handle.t2][i2];
					if ('%dirty' in a1 && !a1['%dirty'] && '%dirty' in a2 && !a2['%dirty']) 
						continue;
					p2 = this.extract(a2,handle.t2,'$position', this.globals);
					s2 = this.extract(a2,handle.t2,'size', this.globals);
					if ((s1+s2)*(s1+s2) > (p1.x-p2.x)*(p1.x-p2.x) + (p1.y-p2.y)*(p1.y-p2.y) ) {
						var add = {ast:handle.body, scope:{'#oldscope':this.globals} };
						add.scope['$'+handle.t1] = [a1];
						if (handle.t1 == handle.t2) add.scope['$'+handle.t1].push(a2);
						else add.scope['$'+handle.t2] = [a2];
						queue.push(add);
						// FIXME: still broken with plant hits plant (somehow)
					}
				}
			}
		}
		return queue;
	}
	this.pullAnOutOfOrder = function(fromNode) {
		// FIXME: seek out outoforder in the first of inorder if present
	}

	this.hearKey = function(keycode) {
		if (keycode >= 97 && keycode <= 122) keycode -= 32;
		if (keycode in this.keylisteners)
			for (i=0; i<this.keylisteners[keycode].length; ++i)
				this.workset.push( {
					ast:this.keylisteners[keycode][i], 
					scope:this.globals
				} );
//		else
//			debug("Unknown keycode "+keycode);
	}
	
	
	this.step = function() {
		if (!this.valid) return;
		this.globals['steps'] += 1;
		var i,j,list;
		// flatten any-orders
		this.workset = this.flatten(this.workset);
		for (i=0; i<this.workset.length; ++i) {
			if ('op' in this.workset[i].ast && this.workset[i].ast.op == 'outoforder' && !this.workset[i].ast.atomic) {
				//alert(strobj(this.workset[i]));
				for (j=0; j<this.workset[i].ast.list.length; ++j)
					this.workset.push( {ast:this.workset[i].ast.list[j], scope:this.workset[i].scope} );
				this.workset.splice(i,1);
			}
		}
		var colidequeue = null;
		// assign each processor some work to do
		for (i = 0; i < this.procs.length; ++i ) {
			if (this.delay[i] > 0) {
			} else if (this.workset.length) {
				var which = (Math.random()*this.workset.length)|0;
				this.procs[i] = this.workset[which];
				this.workset.splice(which,1);
				// FIXME: what if inorder(outoforder, stuff) ?
			} else {
				if (colidequeue === null) colidequeue = this.collisionfinder();
				if (colidequeue.length) {
					var which = (Math.random()*colidequeue.length)|0;
					this.procs[i] = colidequeue[which];
					for (var name in this.procs[i].scope) if (name[0] == '$') {
						this.procs[i].scope[name]['%dirty'] = false;
					}
					colidequeue.splice(which,1);
				} else {
					if (this.bored.length) {
						var which = (Math.random()*this.bored.length)|0;
						this.procs[i] = {ast:this.bored[which], scope:this.globals};
					} else {
						this.procs[i] = null;
					}
				}
			}
		}
		// have each processor do it's work
		for (i = 0; i < this.procs.length; ++i ) {
			if (this.delay[i] > 0) {
				this.delay[i] -= 1;
			} else if (this.procs[i] !== null) {
				var result = this.execute(this.procs[i],i);
				if (result !== null) {
					this.workset.push(result);
				}
			}
		}
	}
	this.toString = function() {
		if (!this.valid) return "Failed to parse input";
		var ans = "Things that exist:";
		var x,i;
		for (x in this.globals)
			if (x[0] == '$' && this.globals[x].length)
				ans += '\n  '+this.globals[x].length+" "+x.substring(1)+"(s)";
//				ans += '\n  '+this.globals[x].length+" "+x.substring(1)+": "+strobj(this.globals[x]);
		for (x in this.globals)
			if (x[0] != '$')
				ans += '\n  '+x+" = "+strobj(this.globals[x]);
		ans += '\n'+this.procs.length+' processor(s) just ran:'
		for (i = 0; i < this.procs.length; ++i)
			ans += '\n  p'+(i+1)+': '+this.parser.oneline(this.procs[i]);
		return ans;
	}
	this.oldToString = function() {
		if (!this.valid) return "Failed to parse input";
		var ans = "Globals:";
		var x,i;
		for (x in this.globals)
			if (x[0] == '$')
				ans += '\n  '+this.globals[x].length+" "+x.substring(1)+": "+strobj(this.globals[x]);
		for (x in this.globals)
			if (x[0] != '$')
				ans += '\n  '+x+" = "+strobj(this.globals[x]);
		ans += '\n'+this.procs.length+' processors just ran'
		for (i = 0; i < this.procs.length; ++i)
			ans += '\n        processor '+(i+1)+':\n'+this.parser.codestring(this.procs[i]);
		return ans;
	}
	/// Returns an array of the lines just executed by processors
	this.linesRun = function() {
		var ans = new Array(this.procs.length);
		for (var i=0; i<ans.length; ++i) {
			if (this.procs[i] === null) ans[i] = 0;
			else {
				ans[i] = this.parser.lineof(this.procs[i]);
			}
		}
		return ans;
	}
	/// Returns an array [{x:num, y:num, radius:num, color:string}, ...]
	this.drawables = function() {
		var ans = [];
		for (var type in this.globals) {
			if (type[0] != '$') continue;
			for (var i=0; i<this.globals[type].length; ++i) {
				var obj = this.globals[type][i];
				var size = this.extract(obj, type, 'size'); // look up whether property or field 
				var position = this.extract(obj, type, 'position');
				var color = this.extract(obj, type, 'color');
				if (color == null) color = 'black';
				if (position && size) {
					ans.push( {x:position.x, y:position.y, radius:size, color:color} );
				}
			}
		}
		// sort biggest to smallest so the are all visible
		function circleCompare(a,b) { return (b.radius - a.radius); }
		ans.sort(circleCompare);
		
		return ans;
	}
}


