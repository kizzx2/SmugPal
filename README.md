# SmugPal

[HTTP Smuggling](https://portswigger.net/web-security/request-smuggling) simulator / visualizer and command line generator.

Workbench for developing HTTP Smuggling / Desync exploits interactively and visually.

![](docs/screenshot.png)

## Help Wanted

- As you can see the current UI does not look great. PRs welcome to improve the look & feel of the app.
- Also PRs are welcome for bugs and other items on the Roadmap.

## Roadmap

- [ ] [H2.TE template](https://portswigger.net/web-security/request-smuggling/advanced/response-queue-poisoning/lab-request-smuggling-h2-response-queue-poisoning-via-te-request-smuggling)
- [ ] [H2.CL template](https://portswigger.net/web-security/request-smuggling/advanced/lab-request-smuggling-h2-cl-request-smuggling)
- [ ] Simulate [TE Obfuscation](https://sc.scomurr.com/http-request-smuggling-obfuscated-te-header/) by having an option that error out on unrecognized encoding
- [ ] CL.0 smuggling template
- [ ] Simulate HTTP/2 (in this mode, the whole request is always read to the end, and the idea is to convert `\r\n` into newlines for backend server to simulate CRLF injection)
- [ ] Simulate `CONNECT` -> `Upgrade: WebSocket` (slide 36 in [this deck](https://www.slideshare.net/neexemil/http-request-smuggling-via-higher-http-versions))