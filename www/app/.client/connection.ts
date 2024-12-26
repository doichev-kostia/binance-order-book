import { atom } from 'jotai';
import * as Client from "./ws.client";

async function reconnect() {
	return new URLSearchParams();
}

export const connection = Client.createConnection({
	url: new URL("wss://stream.binance.com:9443/ws/solusdt@depth"),
	logger: console,
	onReconnect: reconnect,
	reconnectAttempts: 5,
});

const intervalID = window.setInterval(() => {
	Client.refreshReconnectAttempts(connection);
}, 30 * 1000);

window.addEventListener('beforeunload', () => {
	window.clearInterval(intervalID);
	Client.close(connection);
});

Client.addEventListener(connection, 'error', (event) => {
	console.error("[WS]", event);
});

export const connectionAtom = atom(connection);
