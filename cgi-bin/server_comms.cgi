#!/usr/bin/env python
import socket
import cgi,cgitb
import sys
import json

cgitb.enable()

SERVER_ADDR = '130.64.23.165' # homework.cs.tufts.edu (dell24)
PORT_NUM = 55444
BUF_LEN = 2048

if __name__ == "__main__":
	form = cgi.FieldStorage()
	try:
	    uuid=form['uuid'].value
	    command=form['command'].value
	    data=form['data'].value
	except:
	    if len(sys.argv) != 4:
	    	print "Content-type:text/html\n" 
	    	print "Usage: server_comms.py [uuid] [command] [data]"
	    	sys.exit(-1)
	    uuid=sys.argv[1]
	    command=sys.argv[2]
	    data=sys.argv[3]

	full_msg={'uuid':uuid,'command':command,'data':data}
           
	cs = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	cs.connect((SERVER_ADDR,PORT_NUM))
	cs.send(json.dumps(full_msg))

	# wait for response
	response = cs.recv(2048)
	cs.close()
	print "Content-type:text/html"
	print
	print response
