addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const RATE_LIMIT = 4; // requests per minute
const STREAM_DELAY = 1000; // 1 second

const rateLimitMap = new Map();
const visitCounts = new Map();
const streamSeqMap = new Map();

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  const { searchParams } = new URL(request.url);
  const stream = searchParams.get('stream') === 'true';

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !/^Bearer USER\d{3}$/.test(authHeader)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const userId = authHeader.substring(7);
  const userKey = userId;
  const currentTimestamp = Date.now();

  if (!rateLimitMap.has(userKey)) {
    rateLimitMap.set(userKey, []);
  }

  const requestTimes = rateLimitMap.get(userKey);
  const windowStart = currentTimestamp - 60000;

  const recentRequests = requestTimes.filter(time => time > windowStart);
  if (recentRequests.length >= RATE_LIMIT) {
    return jsonResponse({ error: 'Rate Limit Exceeded' }, 429);
  }

  // Record the new request
  recentRequests.push(currentTimestamp);
  rateLimitMap.set(userKey, recentRequests);

  if (!visitCounts.has(userKey)) {
    visitCounts.set(userKey, 0);
  }
  visitCounts.set(userKey, visitCounts.get(userKey) + 1);

  if (!streamSeqMap.has(userKey)) {
    streamSeqMap.set(userKey, 0);
  }

  const visitCount = visitCounts.get(userKey);
  const group = hashUserIdToGroup(userId);

  if (!stream) {
    const payload = createResponsePayload(userId, visitCount, group, RATE_LIMIT - recentRequests.length, 0);
    return jsonResponse(payload);
  } else {
    const responseInit = {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
    const responseStream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < 5; i++) {
          const streamSeq = streamSeqMap.get(userKey) + 1;
          streamSeqMap.set(userKey, streamSeq);

          const payload = createResponsePayload(userId, visitCount, group, RATE_LIMIT - recentRequests.length, streamSeq);
          controller.enqueue(new TextEncoder().encode(JSON.stringify(payload) + '\n'));

          await new Promise(resolve => setTimeout(resolve, STREAM_DELAY));
        }
        controller.close();
      }
    });

    return new Response(responseStream, responseInit);
  }
}

function createResponsePayload(userId, visitCount, group, rateLimitLeft, streamSeq) {
  return {
    message: `Welcome USER_${userId.substring(4)}, this is your visit #${visitCount}`,
    group,
    rate_limit_left: rateLimitLeft,
    stream_seq: streamSeq
  };
}

function hashUserIdToGroup(userId) {
  const userIdNum = parseInt(userId.substring(4), 10);
  return (userIdNum % 10) + 1;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type'
    }
  });
}
