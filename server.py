import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler

# Allow reusing address to avoid "Address already in use" errors on restart
socketserver.TCPServer.allow_reuse_address = True

def run_server():
    global PORT
    while True:
        try:
            with socketserver.TCPServer(("", PORT), Handler) as httpd:
                url = f"http://localhost:{PORT}"
                print(f"Serving at {url}")
                
                # Open browser
                webbrowser.open(url)
                
                # Serve forever
                httpd.serve_forever()
        except OSError as e:
            if e.errno == 98 or e.errno == 10048: # Address already in use
                print(f"Port {PORT} in use, trying {PORT+1}")
                PORT += 1
            else:
                raise

if __name__ == "__main__":
    print("Starting server...")
    run_server()
