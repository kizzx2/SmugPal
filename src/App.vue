<script setup lang="ts">
import Button from 'primevue/Button'
import Dropdown from 'primevue/dropdown'
import Fieldset from 'primevue/fieldset'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed, ref } from 'vue'
import { templates } from './templates'

enum ProcessingMode {
  TE = 'te',
  CL = 'cl',
  ZERO = '0',
  TECL = 'tecl',
  CLTE = 'clte',
  H2 = 'h2',
}

const server1Mode = ref<ProcessingMode>(ProcessingMode.TE)
const server2Mode = ref<ProcessingMode>(ProcessingMode.CL)
const input = ref<string>('')
const sizeCalcInput = ref<string>('')
const colors = ['lightpink', 'lightgreen', 'lightblue', 'lightyellow', 'lightorange', 'lightpurple', 'lightbrown', 'lightgray']
const fontColors = ['black', 'black', 'black', 'black', 'black', 'black', 'black', 'black']
const cmdHostname = ref<string>('example.com')
const cmdPort = ref<string>('80')
const cmdNc = computed(() =>
  process(input.value, server1Mode.value).map((part) => {
    part = part.replace(/'/g, `'"'"'`).replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    return `printf '${part}' | nc ${cmdHostname.value} ${cmdPort.value}`
  })
)
const cmdSocat = computed(() =>
  process(input.value, server1Mode.value).map((part) => {
    part = part.replace(/'/g, `'"'"'`).replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    return `printf '${part}' | socat - OPENSSL:${cmdHostname.value}:${cmdPort.value},verify=0`
  })
)
const h2Snippet = computed(() => {
  if (server1Mode.value !== ProcessingMode.H2) {
    return ''
  }
  const j = JSON.parse(input.value)
  const headerTuples = []
  for (const [k, v] of Object.entries(j)) {
    if (k.startsWith(':')) continue
    headerTuples.push(`("${k}", "${v}")`)
  }
  return templates.h2PythonCode
    .replace('%%%HOST%%%', cmdHostname.value)
    .replace('%%%PORT%%%', cmdPort.value)
    .replace('%%%METHOD%%%', j[':method'])
    .replace('%%%PATH%%%', j[':path'])
    .replace('%%%HEADER_TUPLES%%%', headerTuples.join(', '))
    .replace('%%%BODY%%%', j[':_body'] ?? '')
})

const decLength = computed(() => sizeCalcInput.value.replace(/\n/g, '\r\n').length)
const hexLength = computed(() => sizeCalcInput.value.replace(/\n/g, '\r\n').length.toString(16))

function setTeclTemplate() {
  input.value = templates.teclPayload
  server1Mode.value = ProcessingMode.TE
  server2Mode.value = ProcessingMode.CL
}

function setClteTemplate() {
  input.value = templates.cltePayload
  server1Mode.value = ProcessingMode.CL
  server2Mode.value = ProcessingMode.TE
}

function setCl0Template() {
  input.value = templates.cl0Payload
  server1Mode.value = ProcessingMode.CL
  server2Mode.value = ProcessingMode.ZERO
}

const hintText = computed(() => {
  if (server1Mode.value === ProcessingMode.H2) {
    return '(H2 input is specified as a JSON object and will downgrade to H1 for downstream)'
  } else {
    return '(newlines from this textbox converted to CRLF for the payloads)'
  }
})

function setH2TeTemplate() {
  input.value = templates.h2tePayload
  server1Mode.value = ProcessingMode.H2
  server2Mode.value = ProcessingMode.TE
}

function setH2ClTemplate() {
  input.value = templates.h2clPayload
  server1Mode.value = ProcessingMode.H2
  server2Mode.value = ProcessingMode.CL
}

function setH2WsTemplate() {
  input.value = templates.h2wsPayload
  server1Mode.value = ProcessingMode.H2
  server2Mode.value = ProcessingMode.CL
}

enum State {
  Header,
  Body,
}

function downgradeInput(x: string): string {
  const j = JSON.parse(x)
  let rv = ''
  let method = j[':method']
  let shouldAddContentLength = true
  if (method === 'CONNECT' && j[':protocol'] === 'websocket') {
    method = 'GET'
    shouldAddContentLength = false
    j['Connection'] = 'Upgrade'
    j['Upgrade'] = 'websocket'
  }
  rv += method + ' ' + j[':path'] + ' HTTP/1.1\n'
  rv += 'Host: ' + j[':authority'] + '\n'
  for (const [k, v] of Object.entries(j)) {
    if (k.startsWith(':')) continue
    rv += k + ': ' + v + '\n'
  }
  if (j[':_body'] && shouldAddContentLength) {
    rv += `Content-Length: ${j[':_body'].length}\n`
  }
  rv += '\n'
  if (j[':_body']) {
    // HACK convert \r\n to \n because later we will add it again in `process`
    rv += j[':_body'].replace(/\r\n/g, '\n')
  }
  return rv
}

function process(x: string, mode: ProcessingMode): string[] {
  if (mode === ProcessingMode.H2) {
    return [x]
  }

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
        switch (mode) {
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

          case ProcessingMode.ZERO: {
            rv.push(buf)
            buf = ''
            state = State.Header
            break
          }

          case ProcessingMode.CL: {
            const idx = buf.toLowerCase().indexOf('content-length: ')
            console.assert(idx !== -1)
            const len = parseInt(buf.slice(idx).split('\r\n')[0].split(/\s+/)[1])
            const dat = x.slice(0, len)
            buf += dat
            x = x.slice(len)
            if (dat.length < len) {
              buf += `<em>Error: Expecting ${len - dat.length} more bytes</em>`
            }
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
    let rv = process(input, mode)
    if (mode !== ProcessingMode.H2) rv = rv.map((part) => part.replace(/\r/g, '<span style="color: gray">\\r</span>').replace(/\n/g, '<span style="color: gray">\\n</span>\n'))
    rv = rv.map((part, i) => `<span style="background-color: ${colors[i % colors.length]}; color: ${fontColors[i % fontColors.length]}">${part}</span>`)
    return rv.join('')
  } catch (e) {
    return `<span style="background-color: red; color: white; font-weight: bold">${e}</span>`
  }
}

const server2ModeOptions = [
  { name: 'TE (Follow Transfer-Encoding only)', value: ProcessingMode.TE },
  { name: 'CL (Follow Content-Length only)', value: ProcessingMode.CL },
  { name: 'ZERO (Assume 0 Content-Length)', value: ProcessingMode.ZERO },
  { name: 'TECL (Prefer Transfer-Encoding; then try Content-Length)', value: ProcessingMode.TECL },
  { name: 'CLTE (Prefer Content-Length; then try Transfer-Encoding)', value: ProcessingMode.CLTE },
]

const server1ModeOptions = server2ModeOptions.concat([{ name: 'H2 (HTTP/2)', value: ProcessingMode.H2 }])

const server2Input = computed(() => (server1Mode.value === ProcessingMode.H2 ? downgradeInput(input.value) : input.value))
const server1Result = computed(() => processThenFormat(input.value, server1Mode.value))
const server2Result = computed(() => processThenFormat(server2Input.value, server2Mode.value))

setTeclTemplate()
</script>

<template>
  <h1>SmugPal: HTTP Smuggling Visualizer / Simulator / Command Line Generator</h1>
  <div class="flex">
    <Fieldset legend="Settings" style="flex: 1 0 auto">
      <div class="flex">
        <div>
          <div>Server 1 Mode</div>
          <Dropdown v-model="server1Mode" :options="server1ModeOptions" option-label="name" option-value="value"></Dropdown>
        </div>

        <div>
          <div>Server 2 Mode</div>
          <Dropdown v-model="server2Mode" :options="server2ModeOptions" option-label="name" option-value="value"></Dropdown>
        </div>
      </div>
    </Fieldset>

    <Fieldset legend="Templates" style="flex: 1 0 auto">
      <Button link label="TE-CL" @click="setTeclTemplate()"></Button>
      <Button link label="CL-TE" @click="setClteTemplate()"></Button>
      <Button link label="CL-0" @click="setCl0Template()"></Button>
      <Button link label="H2-TE" @click="setH2TeTemplate()"></Button>
      <Button link label="H2-CL" @click="setH2ClTemplate()"></Button>
      <Button link label="H2-WS" @click="setH2WsTemplate()"></Button>
    </Fieldset>

    <Fieldset legend="Size Calculator" style="flex: 1 0 auto">
      <textarea style="width: 100%" v-model="sizeCalcInput"></textarea><br />
      Dec: {{ decLength }} &nbsp;&nbsp;&nbsp; Hex: {{ hexLength }}<br />
      <small>(newlines in this box are automatically converted to CRLF (2 bytes) for counting)</small>
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
        <small style="font-family: sans-serif">{{ hintText }}</small>
      </div>

      <pre style="flex: 1 0 auto" v-html="server1Result"></pre>
      <pre style="flex: 1 0 auto" v-html="server2Result"></pre>
    </div>
  </Fieldset>

  <br />

  <Fieldset legend="Command Line" class="command-line">
    <div style="display: flex; gap: 1em">
      <div><label>Hostname</label>&nbsp; <InputText placeholder="Hostname" v-model="cmdHostname" />&nbsp;</div>
      <div>
        <label>Port</label>&nbsp;
        <InputText placeholder="Port" v-model="cmdPort" />
      </div>
    </div>
    <div v-if="server1Mode !== 'h2'">
      <small>nc (HTTP)</small>
      <pre style="white-space: normal; overflow-wrap: break-word" v-for="(cmd, i) in cmdNc" :key="i">{{ cmd }}</pre>
      <small>socat (HTTPS)</small>
      <pre style="white-space: normal; overflow-wrap: break-word" v-for="(cmd, i) in cmdSocat" :key="i">{{ cmd }}</pre>
    </div>
    <div v-else>
      <small><a href="https://github.com/python-hyper/h2" target="_blank">h2</a> snippet (HTTPS ALPN)</small>
      <pre>{{ h2Snippet }}</pre>
    </div>
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

.command-line small {
  font-family: sans-serif;
}

.command-line pre {
  background-color: #eee;
  padding: 0.5rem;
  max-width: 100%;
}
</style>
