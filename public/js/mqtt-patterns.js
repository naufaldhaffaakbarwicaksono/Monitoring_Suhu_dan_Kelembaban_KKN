/**
 * Corrected MQTT useEffect patterns for React
 * Note: These won't work on Vercel due to serverless limitations
 */

// OPTION 1: Using useRef (CORRECTED VERSION)
function useMQTTWithRef(mqttUri, options) {
  const [messages, setMessages] = React.useState([]);
  const clientRef = React.useRef(null);

  React.useEffect(() => {
    // FIX: Check if client doesn't exist, not if it does
    if (!clientRef.current) {
      console.log('Creating new MQTT client');
      clientRef.current = mqtt.connect(mqttUri, options);
      
      clientRef.current.on('connect', () => {
        console.log('MQTT Connected');
        clientRef.current.subscribe('test');
      });
      
      clientRef.current.on('message', (topic, message) => {
        setMessages(prev => [...prev, message.toString()]);
      });

      clientRef.current.on('error', (error) => {
        console.error('MQTT Error:', error);
      });
    }

    return () => {
      // Clean up on unmount
      if (clientRef.current) {
        clientRef.current.unsubscribe('test');
        clientRef.current.end();
        clientRef.current = null;
      }
    };
  }, [mqttUri]); // Re-run if URI changes

  return { messages, client: clientRef.current };
}

// OPTION 2: Simple approach (GOOD AS IS)
function useMQTTSimple(mqttUri, options) {
  const [messages, setMessages] = React.useState([]);

  React.useEffect(() => {
    const client = mqtt.connect(mqttUri, options);
    
    client.on('connect', () => {
      console.log('MQTT Connected');
      client.subscribe('test');
    });
    
    client.on('message', (topic, message) => {
      setMessages(prev => [...prev, message.toString()]);
    });

    client.on('error', (error) => {
      console.error('MQTT Error:', error);
    });

    return () => {
      if (client) {
        client.unsubscribe('test');
        client.end();
      }
    };
  }, []); // Empty dependency array - runs once on mount

  return { messages };
}

// OPTION 3: Best practice with proper state management
function useMQTTBestPractice(mqttUri, options, topic = 'test') {
  const [messages, setMessages] = React.useState([]);
  const [connectionStatus, setConnectionStatus] = React.useState('Disconnected');
  const clientRef = React.useRef(null);

  React.useEffect(() => {
    if (!clientRef.current) {
      setConnectionStatus('Connecting...');
      
      const client = mqtt.connect(mqttUri, options);
      clientRef.current = client;

      client.on('connect', () => {
        setConnectionStatus('Connected');
        client.subscribe(topic);
      });

      client.on('message', (receivedTopic, message) => {
        if (receivedTopic === topic) {
          setMessages(prev => [...prev, message.toString()].slice(-100)); // Keep last 100 messages
        }
      });

      client.on('error', (error) => {
        console.error('MQTT Error:', error);
        setConnectionStatus('Error');
      });

      client.on('close', () => {
        setConnectionStatus('Disconnected');
      });
    }

    return () => {
      if (clientRef.current) {
        setConnectionStatus('Disconnecting...');
        clientRef.current.unsubscribe(topic);
        clientRef.current.end();
        clientRef.current = null;
        setConnectionStatus('Disconnected');
      }
    };
  }, [mqttUri, topic]); // Re-run if URI or topic changes

  const sendMessage = React.useCallback((message) => {
    if (clientRef.current && connectionStatus === 'Connected') {
      clientRef.current.publish(topic, message);
    }
  }, [topic, connectionStatus]);

  return { 
    messages, 
    connectionStatus, 
    sendMessage,
    isConnected: connectionStatus === 'Connected'
  };
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    useMQTTWithRef, 
    useMQTTSimple, 
    useMQTTBestPractice 
  };
}
