#!/usr/bin/env python
import socket
import cgi,cgitb
import sys
import json

cgitb.enable()

SERVER_ADDR = '130.64.23.165' # homework.cs.tufts.edu (dell24)
#SERVER_ADDR = '10.3.14.148' # xubuntu
PORT_NUM = 55444
BUF_LEN = 1024
BUF_MAX = 10240 # only allow up to 10KB to transfer per request, in case of runaway program

if __name__ == "__main__":
	form = cgi.FieldStorage()
	try:
	    uuid=form['uuid'].value
	    command=form['command'].value
	    # data might be the empty string, and not actually sent
	    if 'data' in form.keys():
	    	data=form['data'].value
	    else:
	    	data = ''
	    timestamp=form['timestamp'].value
	except KeyError:
	    if len(sys.argv) != 5:
	    	print "Content-type:text/html\n" 
	    	print "Usage: server_comms.py [uuid] [command] [data] [timestamp]"
	    	sys.exit(-1)
	    uuid=sys.argv[1]
	    command=sys.argv[2]
	    data=sys.argv[3]
	    timestamp=sys.argv[4]

	# truncate data to 10KB if necessary
	data = data[:BUF_MAX]
	full_msg={'uuid':uuid,'command':command,'data':data,'timestamp':timestamp}
           
	cs = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	cs.settimeout(15) # timeout of 15 seconds
	cs.connect((SERVER_ADDR,PORT_NUM))
	
	full_json = json.dumps(full_msg)
	msg_len = len(full_json)
	
	# first send the 4-byte length, big-endian
	cs.send(chr(msg_len >> 24))
	cs.send(chr((msg_len & 0xFF0000) >> 16))
	cs.send(chr((msg_len & 0xFF00) >> 8))
	cs.send(chr(msg_len & 0xFF))
	
	# now send the rest of the message
	cs.send(json.dumps(full_msg))

	# wait for response
	
	# first, receive 4-bytes, which will give the total message length
	# (the 4-bytes are not counted)
	bytes_left_str = ''
	while len(bytes_left_str) < 4:
		bytes_left_str += cs.recv(1)
		
	bytes_left = (ord(bytes_left_str[0]) << 24 | 
		     ord(bytes_left_str[1]) << 16 |
		     ord(bytes_left_str[2]) << 8  |
		     ord(bytes_left_str[3]))
	tot_bytes = bytes_left
	# now receive the rest of the message, in 1KB chunks
	full_msg = ""
	while bytes_left > 0:
		if bytes_left < BUF_LEN:
			data_recd = cs.recv(bytes_left)
		else:
			data_recd = cs.recv(BUF_LEN)
		bytes_left -= len(data_recd)
		full_msg += data_recd
		
	cs.close()
	print "Content-type:text/html"
	print
	print full_msg
