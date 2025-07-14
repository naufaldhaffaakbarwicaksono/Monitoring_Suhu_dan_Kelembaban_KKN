/**
 * MQTT Alternative for Vercel Deployment
 * Uses HTTP polling instead of persistent MQTT connections
 */

// React Hook for Sensor Data (replaces MQTT)
function useSensorData(pollingInterval = 5000) {
  const [messages, setMessages] = React.useState([]);
  const [latestData, setLatestData] = React.useState(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const intervalRef = React.useRef(null);

  React.useEffect(() => {
    // Start polling for data
    const startPolling = () => {
      setIsConnected(true);
      
      const poll = async () => {
        try {
          const response = await fetch('/api/latest');
          const result = await response.json();
          
          if (result.success && result.data) {
            setLatestData(result.data);
            setMessages(prev => [...prev, JSON.stringify(result.data)].slice(-50)); // Keep last 50 messages
          }
        } catch (error) {
          console.error('Polling error:', error);
          setIsConnected(false);
        }
      };

      // Initial poll
      poll();
      
      // Set up interval
      intervalRef.current = setInterval(poll, pollingInterval);
    };

    startPolling();

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsConnected(false);
    };
  }, [pollingInterval]);

  return { messages, latestData, isConnected };
}

// React Component Example
function SensorMonitor() {
  const { messages, latestData, isConnected } = useSensorData(3000); // Poll every 3 seconds

  return React.createElement('div', { className: 'sensor-monitor' }, [
    React.createElement('h3', { key: 'title' }, 'Sensor Data Monitor'),
    React.createElement('div', { 
      key: 'status',
      className: `status ${isConnected ? 'connected' : 'disconnected'}` 
    }, `Status: ${isConnected ? 'Connected' : 'Disconnected'}`),
    
    latestData && React.createElement('div', { key: 'latest', className: 'latest-data' }, [
      React.createElement('h4', { key: 'latest-title' }, 'Latest Reading:'),
      React.createElement('p', { key: 'temp' }, `Temperature: ${latestData.temperature}°C`),
      React.createElement('p', { key: 'hum' }, `Humidity: ${latestData.humidity}%`),
      React.createElement('p', { key: 'time' }, `Time: ${new Date(latestData.timestamp).toLocaleString()}`)
    ]),
    
    React.createElement('div', { key: 'messages', className: 'messages' }, [
      React.createElement('h4', { key: 'msg-title' }, 'Recent Messages:'),
      React.createElement('div', { key: 'msg-list', className: 'message-list' },
        messages.slice(-10).map((msg, index) => 
          React.createElement('div', { key: index, className: 'message' }, msg)
        )
      )
    ])
  ]);
}

// If you still want MQTT-like behavior on client side (for development)
function useMQTTAlternative(topic = 'sensor/data', options = {}) {
  const [messages, setMessages] = React.useState([]);
  const clientRef = React.useRef(null);

  React.useEffect(() => {
    // For development with local MQTT broker
    if (typeof mqtt !== 'undefined' && options.developmentMode) {
      const client = mqtt.connect(options.brokerUrl || 'ws://localhost:8083/mqtt');
      clientRef.current = client;

      client.on('connect', () => {
        console.log('MQTT Connected');
        client.subscribe(topic);
      });

      client.on('message', (receivedTopic, message) => {
        if (receivedTopic === topic) {
          setMessages(prev => [...prev, message.toString()].slice(-50));
        }
      });

      client.on('error', (error) => {
        console.error('MQTT Error:', error);
      });

      return () => {
        if (clientRef.current) {
          clientRef.current.unsubscribe(topic);
          clientRef.current.end();
        }
      };
    } else {
      // Fallback to HTTP polling for production
      return useSensorData(options.pollingInterval || 5000);
    }
  }, [topic, options.brokerUrl, options.pollingInterval, options.developmentMode]);

  return { messages, client: clientRef.current };
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { useSensorData, useMQTTAlternative, SensorMonitor };
}
