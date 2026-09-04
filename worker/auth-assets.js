const AUTH_HOST_PATH = '/rentsight/auth-host.html';
const EXTENSION_ORIGIN = 'chrome-extension://pkcmgccphdnmmdjhipgiohmolkailema';

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (new URL(request.url).pathname !== AUTH_HOST_PATH) return response;

    const authHostResponse = new Response(response.body, response);
    authHostResponse.headers.set(
      'Content-Security-Policy',
      `frame-ancestors ${EXTENSION_ORIGIN}`,
    );
    authHostResponse.headers.delete('X-Frame-Options');
    return authHostResponse;
  },
};
