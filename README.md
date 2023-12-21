# SmugPal

[HTTP Smuggling](https://portswigger.net/web-security/request-smuggling) simulator / visualizer and command line generator.

Workbench for developing HTTP Smuggling / Desync exploits interactively and visually.

![](docs/screenshot.png)

## Features

- real time interactive colorization of request splits
- command line generator (netcat / socat for HTTPS)
- HTTP/2 support (ALPN Negotiation)
- ready to use [TE.CL](https://portswigger.net/web-security/request-smuggling/lab-basic-te-cl) template
- ready to use [CL.TE](https://portswigger.net/web-security/request-smuggling/lab-basic-cl-te) template
- ready to use [CL.0](https://portswigger.net/web-security/request-smuggling/browser/cl-0/lab-cl-0-request-smuggling) template
- ready to use [H2.TE](https://portswigger.net/web-security/request-smuggling/advanced/response-queue-poisoning/lab-request-smuggling-h2-response-queue-poisoning-via-te-request-smuggling) template
- ready to use [H2.CL](https://portswigger.net/web-security/request-smuggling/advanced/lab-request-smuggling-h2-cl-request-smuggling) template
- ready to use "H2.WS Upgrade" template (slide 36 in [this deck](https://www.slideshare.net/neexemil/http-request-smuggling-via-higher-http-versions))

## Help Wanted / TODO

- [ ] Support multiple requests in HTTP2 inputs
- [ ] As you can see the current UI does not look great. PRs welcome to improve the look & feel of the app.

## Note about HTTP/2 without HTTPS

The current payload template assumes HTTPS when used with HTTP/2. This is because as of writing, apparently [mitmproxy does not support h2c](https://github.com/mitmproxy/mitmproxy/issues/3362). When I tried with Burp I got similar results so I assume it is also the same case.

If you want to use it without HTTPS, simply comment out the line that says `ctx.wrap_socket` in the script.