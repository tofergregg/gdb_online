#!/usr/sup/bin/python
import cgi,cgitb
import sys
import json
import subprocess

cgitb.enable()

PROG_FOLDER = "programs/"

def compile(uuid,program):
	# save the file as programs/[uuid].cpp and compile it
	# with -g -O0 programs/[uuid].cpp -o programs/bin/[uuid]
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
	return compile_output,compile_proc.returncode

if __name__ == "__main__":
	form = cgi.FieldStorage()
	try:
	    uuid=form['uuid'].value
	    program=form['program'].value
	except:
	    if len(sys.argv) != 3:
	    	print "Content-type:text/html\n" 
	    	print "Usage: compile_prog.py [uuid] [program]"
	    	sys.exit(-1)
	    uuid=sys.argv[1]
	    program=sys.argv[2]

	compile_output,returncode = compile(uuid,program)

	print "Content-type:text/html"
	print
	print json.dumps({"output":compile_output,'returncode':returncode})
