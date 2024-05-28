async function testAPI(stream) {
    const endpoint = 'https://worker-tight-hat-f421.dalcikferhateren.workers.dev'; 
    const token = 'Bearer USER456'; 
  
    try {
      const response = await fetch(`${endpoint}?stream=${stream}`, {
        headers: {
          'Authorization': token
        }
      });
  
      if (response.status === 401) {
        console.error('Unauthorized');
        return;
      }
  
      if (response.status === 429) {
        console.error('Rate Limit Exceeded');
        return;
      }
  
      if (stream) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
  
        reader.read().then(function processText({ done, value }) {
          if (done) {
            console.log('Stream finished');
            return;
          }
          console.log(decoder.decode(value));
          return reader.read().then(processText);
        });
      } else {
        const data = await response.json();
        console.log(data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  
  //testAPI();
  