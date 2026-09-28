/**
 * WebSocket 封装
 */

export function createSocket(handlers) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = proto + '//' + location.host + '/ws'
  let socket = null
  let closedByUser = false
  let reconnectTimer = null
  let retry = 0
  const queue = []

  function flush() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    while (queue.length) {
      const item = queue.shift()
      try { socket.send(JSON.stringify(item)) } catch (e) { /* ignore */ }
    }
  }

  function connect() {
    socket = new WebSocket(url)

    socket.onopen = () => {
      retry = 0
      handlers.onOpen && handlers.onOpen()
      flush()
    }

    socket.onmessage = (ev) => {
      let msg
      try {
        msg = JSON.parse(ev.data)
      } catch (e) {
        return
      }
      handlers.onMessage && handlers.onMessage(msg)
    }

    socket.onclose = () => {
      handlers.onClose && handlers.onClose()
      if (!closedByUser) {
        retry++
        const delay = Math.min(1000 * retry, 5000)
        reconnectTimer = setTimeout(connect, delay)
      }
    }

    socket.onerror = () => {
      handlers.onError && handlers.onError()
    }
  }

  connect()

  return {
    send(type, payload) {
      const item = { type, payload }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(item))
      } else {
        // 未连接：入队，连上后自动补发
        queue.push(item)
      }
    },
    isOpen() {
      return !!socket && socket.readyState === WebSocket.OPEN
    },
    close() {
      closedByUser = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (socket) socket.close()
    }
  }
}
