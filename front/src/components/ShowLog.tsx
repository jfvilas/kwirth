import { useEffect, useState } from 'react';

const ShowLog = (props:any) => {
  const [messages, setMessages] = useState<string[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(props.server);

    ws.onopen = () => {
      console.log('Connected to the WebSocket server');
    };

    ws.onmessage = (event) => {
      const newMessage = event.data;
      console.log(newMessage.toString());
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    };

    ws.onclose = () => {
      console.log('Disconnected from the WebSocket server');
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      var payload={ scope:props.scope, namespace:props.namespace, deploymentName:props.obj};
      socket.send(JSON.stringify(payload));
    }
    else {
      console.error('WebSocket is not open');
    }
  };

  return (
      <div>
        {messages.map((message, index) => (
          <div key={index}>{message}</div>
        ))}
      </div>
  );
};

export default ShowLog;