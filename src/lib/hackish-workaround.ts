const WebSocket = require("ws");

// phoenix.js is built for the browser
// to make it work on node, supply Websocket as global var
global.window = {
  WebSocket,
};
