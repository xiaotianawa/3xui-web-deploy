let ws = null;

export function useWebSocket() {
  if (!ws) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;
    
    ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      ws = null;
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  return { ws };
}

export function closeWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
}
