import { io } from 'socket.io-client'

export const socket = io('https://ims-api-id38.onrender.com', {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000
})

// Add connection event listeners
socket.on('connect', () => {
})

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error)
})

socket.on('disconnect', (reason) => {
})

// Test socket connection
setTimeout(() => {
  if (socket.connected) {
  } else {
  }
}, 2000)
