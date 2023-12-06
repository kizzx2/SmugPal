<script setup lang="ts">

import { computed, ref } from 'vue';

enum ProcessingMode { TE = 'te', CL = 'cl' }

const server1Moe = ref<ProcessingMode>(ProcessingMode.TE)
const server2Mode = ref<ProcessingMode>(ProcessingMode.CL)
const input = ref<string>('')
const colors = ['pink', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray']
const fontColors = ['white', 'black', 'white', 'black', 'black', 'white', 'black', 'white', 'white']

enum State { Header, Body }

function process(x: string, mode: ProcessingMode): string[] {
  x = x.replace(/\n/g, '\r\n')
  const rv = []
  let buf = ''
  let state = State.Header
  while (x.length > 0) {
    switch (state) {
      case State.Header: {
        const idx = x.indexOf('\r\n\r\n')
        buf += x.slice(0, idx + 4)
        x = x.slice(idx + 4)
        state = State.Body
        break
      }
      case State.Body: {
        switch(mode) {
          case ProcessingMode.TE: {
            if (buf.toLowerCase().indexOf("transfer-encoding: ") === -1) {
              throw new Error("Transfer-Encoding header not found for TE mode")
            }
            const idx = x.indexOf('\r\n')
            const len = parseInt(x.slice(0, idx), 16)
            if (isNaN(len)) {
              throw new Error(`Error at ${buf.length} (${x.slice(0, 10)}...): invalid chunk length`)
            }
            buf += x.slice(0, idx + 2 + len)
            x = x.slice(idx + 2 + len)
            if (!x.startsWith('\r\n')) {
              throw new Error(`Error at ${buf.length} (${x.slice(0, 10)}...): expecting CRLF after chunk`)
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
            const idx = buf.toLowerCase().indexOf("content-length: ")
            if (idx === -1) {
              throw new Error("Content-Length header not found for CL mode")
            }
            const len = parseInt(buf.slice(idx).split('\r\n')[0].split(/\s+/)[1])
            buf += x.slice(0, idx + len)
            x = x.slice(idx + 2 + len)
            rv.push(buf)
            buf = ''
            state = State.Header
            break
          }

          default:
            throw new Error('Invalid mode')
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
    return process(input, mode).map((part, i) => `<span style="background-color: ${colors[i % colors.length]}; color: ${fontColors[i % fontColors.length]}">${part}</span>`).join('')
  } catch(e) {
    return `<span style="background-color: red; color: white; font-weight: bold">${e}</span>`
  }
}

const server1Result = computed(() => processThenFormat(input.value, server1Moe.value))
const server2Result = computed(() => processThenFormat(input.value, server2Mode.value))
</script>

<template>
  <h1>SmugPal: HTTP Smuggling Visualizer / Simulator</h1>
  <fieldset>
    <legend>Settings</legend>
    <div style="display: flex">
      <div>
        <div>Server 1 Mode</div>
        <select v-model="server1Moe">
          <option :value="ProcessingMode.TE">TE (Follow Transfer-Encoding)</option>
          <option :value="ProcessingMode.CL">CL (Follow Content-Length)</option>
        </select>
      </div>

      <div>
        <div>Server 2 Mode</div>
        <select v-model="server2Mode">
          <option :value="ProcessingMode.TE">TE (Follow Transfer-Encoding)</option>
          <option :value="ProcessingMode.CL">CL (Follow Content-Length)</option>
        </select>
      </div>
    </div>
  </fieldset>

  <fieldset>
    <legend>Templates</legend>
    <a href="#">TE-CL</a> (<a href="#">?</a>)
    <a href="#">CL-TE</a> (<a href="#">?</a>)
    <a href="#">CL-0</a> (<a href="#">?</a>)
  </fieldset>

  <fieldset style="font-family: monospace;">
    <legend>Playground</legend>
    <div style="display: flex">
      <h3 style="flex: 1 0 auto">Input</h3>
      <h3 style="flex: 1 0 auto">Server 1 Sees</h3>
      <h3 style="flex: 1 0 auto">Server 2 Sees</h3>
    </div>

    <div style="display: flex">
      <div style="flex: 0 0 auto; display: flex; flex-direction: column">
        <textarea v-model="input" autofocus style="flex: 1 1 auto"></textarea>
        <br />
        Note: newlines are automatically converted to CRLF during processing
      </div>

      <pre style="flex: 1 0 auto" v-html="server1Result"></pre>

      <pre style="flex: 1 0 auto" v-html="server2Result"></pre>
    </div>
  </fieldset>
</template>

<style scoped></style>
