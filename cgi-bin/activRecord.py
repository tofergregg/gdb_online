#!/usr/bin/env python

import sys,os,pty
import subprocess
import select
import fcntl
import time, sched, datetime
import socket
import json
import threading
import mi_parser

BUF_LEN = 1024
IP_ADDR = "130.64.23.165"
PORT_NUM = 55444
#GDB_WARNING="warning: GDB: Failed to set controlling terminal: Operation not permitted\r\n"
GDB_WARNING='&"warning: GDB: Failed to set controlling terminal: Operation not permitted\\n"\r\n'
PROG_FOLDER = "/tmp/programs/"
MAX_RESPONSE = 10240 # only allow up to a 10KB response, in case something gets out of control
GDB_PROMPT = '\n(gdb) \n'


class Gdb_session:
	ON_POSIX = 'posix' in sys.builtin_module_names

	def __init__(self,program_name):
		self.last_interaction = datetime.datetime.now()
		program_pts,self.program_fd = self.set_pty_for_gdb()
		self.p = subprocess.Popen(['gdb','-q','-i','mi',program_name], stdout=subprocess.PIPE, stdin=subprocess.PIPE,
				stderr=subprocess.PIPE,bufsize=1, close_fds=self.ON_POSIX)

		fl = fcntl.fcntl(self.p.stdout, fcntl.F_GETFL)
		fcntl.fcntl(self.p.stdout, fcntl.F_SETFL, fl | os.O_NONBLOCK)

		fl = fcntl.fcntl(self.p.stderr, fcntl.F_GETFL)
		fcntl.fcntl(self.p.stderr, fcntl.F_SETFL, fl | os.O_NONBLOCK)

		# make stdin non-blocking
		fl = fcntl.fcntl(sys.stdin, fcntl.F_GETFL)
		fcntl.fcntl(sys.stdin, fcntl.F_SETFL, fl | os.O_NONBLOCK)

		# set gdb listsize to 10000 to always get all output
		self.send_command(self.p,'set listsize 10000')
		self.send_command(self.p,'set pagination off')
		self.send_command(self.p,'set confirm off')
		
		# redefine shell to a blank function to be safer
		self.send_command(self.p,'define shell')
		self.send_command(self.p,'end')
		
		time.sleep(2) # wait for gdb to load, etc.
		self.read_gdb_output(self.p) # ignore

		self.set_func_breakpoints(self.p)

		# set pts
		self.send_command(self.p,'tty '+program_pts)

		# start running program
		self.send_command(self.p,'run')
		
		# it looks like the next line is going to cause too-slow behavior
		#self.send_command(self.p,'target record-full') # record for stepping backwards
		# this could be useful for finding the return value of a function:
		#   if "where full" produces one fewer stack frame than the previous
		#   "where full," then we can do a "reverse-next" and then a "finish"
		#   command to retrieve the return value for the function.
		time.sleep(3) # wait a bit

	def send_command(self,proc,cmd):
		proc.stdin.write(cmd+'\n')

	def read_gdb_output(self,proc):
		lines = ""
		while 1:
			# read from stderr
			try:
				c=proc.stderr.read(1)
			except IOError:
				break # no output
			lines+=c
		# read from stdout
		while 1:
			try:
				c=proc.stdout.read(1)
			except IOError:
				break # no output
			lines+=c
		return lines[:MAX_RESPONSE]

	def send_prog_input(self,fd,text):
		os.write(fd,text+'\n')

	def read_prog_output(self,fd):
		lines = ""
		# read from stdout
		while 1:
			try:
				c=os.read(fd,1)
			except OSError:
				break # no output
			lines+=c
		return lines[:MAX_RESPONSE]

	def set_func_breakpoints(self,p):
		# get a list of all functions (it's going to be big...
		self.send_command(p,'info functions')
		time.sleep(1)
		all_funcs = self.read_gdb_output(p)
				
		# strip out initial '~"' and final '\n"' (from mi)
		all_funcs = all_funcs.replace('~"','').replace('\\n"','').replace('\\n','\n')
		
		#print all_funcs


		# just grab the first file, and turn into list of functions
		all_funcs = all_funcs.split('File ')[1].split("\n\n")[0]
		all_funcs = all_funcs.split('\n')[2:]
		
		# function could be "static", and remove if it is
		all_funcs = [x[len("static "):] if x.startswith('static ') else x for x in all_funcs]

		# just strip out the definition, without the return type and without the semicolon
		all_funcs = [' '.join(x.split(' ')[1:]) for x in all_funcs]
		all_funcs = [x.split(';')[0] for x in all_funcs]
		
		# when compiled with g++, there are some initialization functions that we
		# don't want to break on
		all_funcs = [x for x in all_funcs if "_GLOBAL__" not in x]
		all_funcs = [x for x in all_funcs if "__static" not in x]
		
		#print "all functions:"
		#print all_funcs

		# set breakpoints for each function
		for func in all_funcs:
			self.send_command(p,'b '+func)

		# get response
		time.sleep(0.2)
		print self.read_gdb_output(p) #ignore
		
	def clear_breakpoints(self):
		self.send_command(self.p,'delete')

	def set_pty_for_gdb(self):
		# sets up a pseudo-terminal that GDB can write to and read from
		# returns a tuple with the terminal tty to send to gdb, and the file
		# descriptor to use for reading/writing with os

		pid,fd = pty.fork() # returns a tuple with (pid,file descriptor)
		if pid==0: # forked process, which we want to just hang out to be controlled by GDB
			# just wait forever
			while 1:
				time.sleep(1000)

		ps_output = subprocess.Popen(['ps','-A'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
		ps_stdout,ps_stderr = ps_output.communicate()

		# find our pts by pid (would look for "tty" on mac, but it is pts on linux)
		ps_stdout = ps_stdout.split('\n') # split into lines
		for line in ps_stdout:
			if str(pid) in line:
				pts_line = line
				break
		# format for pts_line should be: "xxxx pts/d   tt:tt:tt python"
		# where "pts/d" denotes /dev/pts/d where d is a digit
		# we want to get just the pts/d

		pts = "/dev/pts/"+(pts_line.split('pts/')[1].split(' ')[0])

		fl = fcntl.fcntl(fd, fcntl.F_GETFL)
		fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

		#print pts
		return pts,fd

	def send_mi_command(self,command):
		self.send_to_gdb('g',command)
		time.sleep(0.3)
		gdb_output = self.read_gdb_output(self.p).replace(GDB_PROMPT,'')
		print "mi-output:",gdb_output
		output = mi_parser.process(gdb_output+'\n').__dict__
		return output
		
	def get_program_status(self):
		MAX_FRAMES = 10
		# first, get the arguments for each frame
		#    -stack-list-arguments 1 0 MAX_FRAMES
		#    (the "1" is to "show values")
		all_output = []
		all_output.append(self.send_mi_command('-stack-list-arguments 1 0 '+str(MAX_FRAMES)))
				
		# next, get each function name and line number
		#    -stack-list-frames 0 MAX_FRAMES
		frames = self.send_mi_command('-stack-list-frames 0 '+str(MAX_FRAMES))
		all_output.append(frames)
		if frames['class_'] == 'done': # success
			frame_count = len(frames['result']['stack'])
			# walk through all frames (!) to get the local variables
			#    we first have to change to each frame
			#    -stack-select-frame framenum
			frame_output = []
			for i in range(frame_count):
				self.send_mi_command('-stack-select-frame ')
				# now, we can list all the local variables
				#    -stack-list-locals --simple-values
				frame_output.append(self.send_mi_command('-stack-list-locals --simple-values'))
			all_output.append(frame_output)
	
		return {'gdb':all_output}

		# return status for use on web page
		return {'error':"no command"}
		
	def send_to_gdb(self,cmd_type,command):
		try:
			# command can be to either gdb or to the program, and
			# we have to let the user (web page) determine this
			# So, cmd_type should be "g" for gdb input,
			# and "c" for console input
			self.last_interaction = datetime.datetime.now()
			 
			if cmd_type == 'g':
				self.send_command(self.p,command)
				return "ok"
			elif cmd_type == 'c':
				self.send_prog_input(self.program_fd,command)
				return "ok"
			else:
				return "did not send command"
		except EOFError:
			return "Cannot send command."

	def get_output(self):
		# read gdb output
		gdb_output = self.read_gdb_output(self.p)

		# look for output from the program
		prog_output = self.read_prog_output(self.program_fd)

		return {'gdb':gdb_output,'console':prog_output}
	
	def get_console_output(self):
		# read console output
		prog_output = self.read_prog_output(self.program_fd)
		return {'gdb':'','console':prog_output}
	
class Gdb_sessions:
	def __init__(self):
		self.sessions = {}

	def create_session(self,uuid):
		self.sessions[uuid]=Gdb_session(PROG_FOLDER+"bin/"+uuid)
		session_start_output = self.sessions[uuid].get_output()
		# remove pesky gdb warning about the console
		cons_output = session_start_output['console']
		session_start_output['console'] = cons_output.replace(GDB_WARNING,'',1)
		return session_start_output

	def send_command_to_session(self,uuid,command,data):
		if command == 'load':
			# no uuid yet, program name will be the uuid
			return self.create_session(uuid)
		# session should already exist
		if not self.sessions.has_key(uuid):
			return {'error':"uuid does not have associated gdb instance."}
		session = self.sessions[uuid]

		if command == 'gdb_command':
			if session.send_to_gdb('g',data) == 'ok':
				time.sleep(1) # wait for processing
				return session.get_output()
		elif command == 'console_command':
			if session.send_to_gdb('c',data) == 'ok':
				time.sleep(0.3) # wait for processing
				return session.get_output()
		elif command == 'get_all_output':
			return session.get_output()
		elif command == 'get_console_output':
			return session.get_console_output()
		elif command == 'run':
			session.clear_breakpoints()
			session.send_to_gdb('g','continue')
			return session.get_output()
		elif command == 'status':
			# get the program status
			return session.get_program_status()
		return {'error':"no command"}

def compile(uuid,program):
	# make sure /tmp/programs/bin exists
	try:
		os.makedirs(PROG_FOLDER+"bin/")
	except OSError:
		pass # dirs already exist

	# save the file as /tmp/programs/[uuid].cpp and compile it
	# with -g -O0 programs/[uuid].cpp -o /tmp/programs/bin/[uuid]
	prog_name = PROG_FOLDER+uuid+".cpp"
	
	# save the program
	with open(prog_name,"w") as f:
		f.write(program)
		
	#compile the program, and return the output of the compilation
	compile_proc = subprocess.Popen(['clang++','-g','-O0',
				prog_name,'-o',PROG_FOLDER+'bin/'+uuid],
				stdout=subprocess.PIPE,stderr=subprocess.PIPE)
	compile_proc.wait()

	compile_output = compile_proc.stdout.read()+compile_proc.stderr.read()
	
	# sneakily compile with g++, which does not optimize as much for gdb
	compile_proc = subprocess.Popen(['g++','-g','-O0',
				prog_name,'-o',PROG_FOLDER+'bin/'+uuid],
				stdout=subprocess.PIPE,stderr=subprocess.PIPE)
	compile_proc.wait()
	
	return {'output':compile_output,'returncode':compile_proc.returncode}

def handle_connection(gs,connection,address):
	#uuid,program_name=sys.argv[1],sys.argv[2]
	# get the data from the connection
	print "connection: "+str(connection)+", address:"+str(address)

	# first, receive 4-bytes, which will give the total message length
	# (the 4-bytes are not counted)
	
	bytes_left_str = ''
	while len(bytes_left_str) < 4:
		bytes_left_str += connection.recv(1)
	
	bytes_left = (ord(bytes_left_str[0]) << 24 | 
		     ord(bytes_left_str[1]) << 16 |
		     ord(bytes_left_str[2]) << 8  |
		     ord(bytes_left_str[3]))
	
	# now receive the rest of the message, in 1KB chunks
	full_msg = ""
	while bytes_left > 0:
		if bytes_left < BUF_LEN:
			buf = connection.recv(bytes_left)
		else:
			buf = connection.recv(BUF_LEN)
		bytes_left -= len(buf)
		full_msg += buf
		
	full_msg = json.loads(full_msg) # a dict with uuid, command, and data
	print "Command:"
	print "\tuuid:",full_msg['uuid']
	print "\tcommand:",full_msg['command']
	print "\tdata:",full_msg['data']

	if full_msg['command']=='compile':
		response = compile(full_msg['uuid'],full_msg['data'])
	else:
		response = gs.send_command_to_session(full_msg['uuid'],
						full_msg['command'],
						full_msg['data'])
	response = json.dumps(response)
	print response
	msg_len = len(response)
	print "msg_len:",msg_len
	# first send the 4-byte length, big-endian
	connection.send(chr(msg_len >> 24))
	connection.send(chr((msg_len & 0xFF0000) >> 16))
	connection.send(chr((msg_len & 0xFF00) >> 8))
	connection.send(chr(msg_len & 0xFF))
	
	# send the actual message
	connection.send(response)
	
	print "connection closed with address "+str(address)

def cleanup_gdb_sessions(sc,gs):
	print "Cleaning up old gdb sessions..."
	now = datetime.datetime.now()
	sessions_to_kill = []
	
	for session in gs.sessions:
		elapsed_time = now - gs.sessions[session].last_interaction
		minutes,seconds = divmod(elapsed_time.days * 86400 + elapsed_time.seconds, 60)
		if minutes > 10:
			print "Killing session "+session
			gs.sessions[session].p.kill() # kill the gdb process
			sessions_to_kill.append(session) # plan to remove the session
	for session in sessions_to_kill:
		gs.sessions.pop(session) # kill it
	
	sc.enter(10,1,cleanup_gdb_sessions,(sc,gs))

if __name__ == "__main__":
	gs = Gdb_sessions()
	
	# set up timer to kill Gdb_sessions that haven't been touched in 10 minutes
	# run scheduler in its own thread, every 10 seconds
	
	s = sched.scheduler(time.time, time.sleep)
	s.enter(10,1,cleanup_gdb_sessions,(s,gs))
	
	t_clean = threading.Thread(target=s.run)
	t_clean.start()
	
	print "Setting up socket server"
	serversocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	serversocket.bind((IP_ADDR, PORT_NUM))
	serversocket.listen(5) # become a server socket, maximum 5 connections
	while True:
	    print "Waiting for new connection..."
	    connection, address = serversocket.accept()
	    t = threading.Thread(target=handle_connection,args=(gs,connection,address))
	    t.start()
