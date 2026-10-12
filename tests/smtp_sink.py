"""Loopback-only SMTP test sink; never imported by the application."""
import email
import re
import socketserver
import threading

class Sink:
    def __init__(self):
        self.codes={}
        sink=self
        class Handler(socketserver.StreamRequestHandler):
            def handle(self):
                self.wfile.write(b'220 localhost test SMTP\r\n')
                recipient=''
                while True:
                    line=self.rfile.readline(8192)
                    if not line:return
                    command=line.decode().strip()
                    if command.upper().startswith('EHLO'):
                        self.wfile.write(b'250-localhost\r\n250 SIZE 100000\r\n')
                    elif command.upper().startswith('RCPT TO:'):
                        recipient=command.split(':',1)[1].strip().strip('<>')
                        self.wfile.write(b'250 OK\r\n')
                    elif command.upper()=='DATA':
                        self.wfile.write(b'354 End with dot\r\n')
                        data=bytearray()
                        while True:
                            item=self.rfile.readline(8192)
                            if item in (b'.\r\n',b''):break
                            data.extend(item)
                        message=email.message_from_bytes(bytes(data))
                        body=message.get_payload(decode=True).decode()
                        match=re.search(r'code is: (\d{6})',body)
                        if match:sink.codes[recipient]=match[1]
                        self.wfile.write(b'250 Queued\r\n')
                    elif command.upper()=='QUIT':
                        self.wfile.write(b'221 Bye\r\n');return
                    else:self.wfile.write(b'250 OK\r\n')
        self.server=socketserver.ThreadingTCPServer(('127.0.0.1',0),Handler)
        self.server.daemon_threads=True
        self.port=self.server.server_address[1]
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)
    def __enter__(self):self.thread.start();return self
    def __exit__(self,*args):self.server.shutdown();self.server.server_close();self.thread.join()
