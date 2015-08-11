#!/usr/bin/env python

import sys,os,pty
import subprocess
import select
import fcntl
import time
import socket
import json
import threading

BUF_LEN = 1024
IP_ADDR = "130.64.23.165"
PORT_NUM = 55444
GDB_WARNING="warning: GDB: Failed to set controlling terminal: Operation not permitted\r\n"
PROG_FOLDER = "/tmp/programs/"


class Gdb_session:
	ON_POSIX = 'posix' in sys.builtin_module_names

	def __init__(self,program_name):
		program_pts,self.program_fd = self.set_pty_for_gdb()
		self.p = subprocess.Popen(['gdb',program_name], stdout=subprocess.PIPE, stdin=subprocess.PIPE,
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
		time.sleep(2) # wait for gdb to load, etc.
		print self.read_gdb_output(self.p) # ignore

		self.set_func_breakpoints(self.p)

		# set pts
		self.send_command(self.p,'tty '+program_pts)

		# start running program
		self.send_command(self.p,'run')
		time.sleep(0.5) # wait a bit

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
		return lines

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
		return lines

	def set_func_breakpoints(self,p):
		# get a list of all functions (it's going to be big...
		self.send_command(p,'info functions')
		time.sleep(1)
		all_funcs = self.read_gdb_output(p)

		# just grab the first file, and turn into list of functions
		all_funcs = all_funcs.split('File ')[1]
		all_funcs = all_funcs.split('\n')[1:-2]

		# just strip out the definition, without the return type and without the semicolon
		all_funcs = [x.split(' ')[1] for x in all_funcs]
		all_funcs = [x.split(';')[0] for x in all_funcs]

		#print all_funcs

		# find the line number for each function
		# first, set the listsize so we only get one line
		self.send_command(p,'set listsize 1')
		time.sleep(0.1)
		self.read_gdb_output(p)

		# get a list of the function lines
		func_lines=[]
		for func in all_funcs:
			self.send_command(p,'list '+func)
			time.sleep(0.2)
			response = self.read_gdb_output(p)

			# split on tab to get just the line number
			response = response.split('\t')[0]
			func_lines.append(response)

		# set breakpoints for each function
		for func in func_lines:
			self.send_command(p,'b '+func)

		# get response
		time.sleep(0.2)
		self.read_gdb_output(p)

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

	def send_to_gdb(self,cmd_type,command):
		try:
			# command can be to either gdb or to the program, and
			# we have to let the user (web page) determine this
			# So, cmd_type should be "g" for gdb input,
			# and "c" for console input
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
		
	# update PATH so we can use clang++
	#compile the program, and return the output of the compilation
	compile_proc = subprocess.Popen(['clang++','-g','-O0',
				prog_name,'-o',PROG_FOLDER+'bin/'+uuid],
				stdout=subprocess.PIPE,stderr=subprocess.PIPE)
	compile_proc.wait()

	compile_output = compile_proc.stdout.read()+compile_proc.stderr.read()
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
	# first send the 4-byte length, big-endian
	connection.send(chr(msg_len >> 24))
	connection.send(chr((msg_len & 0xFF0000) >> 16))
	connection.send(chr((msg_len & 0xFF00) >> 8))
	connection.send(chr(msg_len & 0xFF))
	
	# send the actual message
	connection.send(response)
	
	print "connection closed with address "+str(address)

if __name__ == "__main__":
	gs = Gdb_sessions()
	serversocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	serversocket.bind((IP_ADDR, PORT_NUM))
	serversocket.listen(5) # become a server socket, maximum 5 connections
	while True:
	    print "Waiting for new connection..."
	    connection, address = serversocket.accept()
	    t = threading.Thread(target=handle_connection,args=(gs,connection,address))
	    t.start()
