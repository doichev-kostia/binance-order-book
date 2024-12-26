/* https://gist.github.com/doichev-kostia/cfebe6d907b9a22cf0f3a962cbfda88e */
export type LogFn = {
	(obj: unknown, msg?: string, ...args: any[]): void;
	(msg: string, ...args: any[]): void;
};

export interface Logger {
	info: LogFn;
	warn: LogFn;
	error: LogFn;
	debug: LogFn;
}

const noopLogger: Logger = {
	info() { },
	error() { },
	warn() { },
	debug() { },
};

const keys = {
	pubSub: Symbol('connection:pubSub'),
	logger: Symbol('connection:logger'),
	connectionTimeoutMillis: Symbol('connection:connectionTimeoutMillis'),
	reconnectAttempts: Symbol('connection:reconnectAttempts'),
	attemptsLeft: Symbol('connection:attemptsLeft'),
	reconnectFn: Symbol('connection:reconnectFn'),
} as const;

const DEFAULT_RECONNECT_ATTEMPTS = 5;

const CONNECTION_TIMEOUT_MILLIS = 5 * 1000;

const ABNORMAL_CLOSURE_CODE = 1006;

/**
 * Function that is called on every reconnect attempt. It should return a new set of URLSearchParams that will be used to reconnect.
 *
 * The returned URLSearchParams will replace the current ones in the connection URL.
 * In case the previous params need to be preserved, they should be included in the returned URLSearchParams.
 *
 * If the function throws an error, the reconnection will be aborted.
 */
export type ReconnectFn = (params: URLSearchParams) => Promise<URLSearchParams>;

export type ConnectionOptions = {
	url: string | URL;
	params?: URLSearchParams;
	/**
	 * @default 5000 (5 seconds)
	 */
	connectionTimeoutMillis?: number;
	onReconnect?: ReconnectFn;
	/**
	 * @default 5
	 */
	reconnectAttempts?: number;
	/**
	 * @default noopLogger (no logging)
	 */
	logger?: Logger;
};

const IDLE = 4;
type State =
	| typeof WebSocket.CONNECTING
	| typeof WebSocket.OPEN
	| typeof WebSocket.CLOSING
	| typeof WebSocket.CLOSED
	| typeof IDLE;

export type Connection = {
	url: URL;
	raw: WebSocket | undefined;
	state: State | undefined;

	[key: symbol]: any;
};

class ConnectionEventTarget extends EventTarget {
	url: URL;

	constructor(url: URL) {
		super();
		this.url = url;
	}
}

export function createConnection(options: ConnectionOptions) {
	const url = typeof options.url === 'string' ? new URL(options.url) : options.url;
	if (options.params) {
		url.search = options.params.toString();
	}

	const pubSub = new ConnectionEventTarget(url);

	const reconnectAttempts = options.reconnectAttempts ?? DEFAULT_RECONNECT_ATTEMPTS;

	const connection: Connection = {
		url,
		raw: undefined,
		state: IDLE,

		[keys.pubSub]: pubSub,
		[keys.logger]: options.logger ?? noopLogger,
		[keys.connectionTimeoutMillis]: options.connectionTimeoutMillis ?? CONNECTION_TIMEOUT_MILLIS,
		[keys.reconnectAttempts]: reconnectAttempts,
		[keys.attemptsLeft]: reconnectAttempts,
		[keys.reconnectFn]: options.onReconnect,
	};
	return connection;
}

export function reconnect(connection: Connection) {
	const logger = getLogger(connection);

	if (connection.state === WebSocket.CONNECTING) {
		return;
	}

	const ws = connection.raw;
	if (ws?.readyState === WebSocket.OPEN) {
		logger.debug('Closing the open connection before reconnecting');
		ws.close();
	}
	const currentParams = new URLSearchParams(connection.url.search);

	connection.state = WebSocket.CONNECTING;
	const onReconnect = getReconnectFn(connection);
	if (onReconnect) {
		void onReconnect(currentParams)
			.then((searchParams) => {
				connection.url.search = searchParams.toString();
				logger.debug(`Reconnecting with params: ${searchParams.toString()}`);
				connect(connection);
			})
			.catch((error) => {
				logger.error(`Error in onReconnect function: ${error}`);
			});
	} else {
		connect(connection);
	}
}

/**
 * Will reset reconnect attempts back to the initial value and try to connect again in case the connection is closed
 */
export function refreshReconnectAttempts(connection: Connection) {
	connection[keys.attemptsLeft] = connection[keys.reconnectAttempts];

	if (!connection.raw) {
		return;
	}

	if (connection.raw.readyState === WebSocket.CLOSED || connection.raw.readyState === WebSocket.CLOSING) {
		reconnect(connection);
	}
}

/**
 * Connects to the server and sets up the event listeners.
 * If the connection is closed with code 1006 (abnormal closure) and there are attempts left, it will try to reconnect.
 * If the connection timeout is reached, it will close the connection with code 1006 and trigger the reconnect logic.
 *
 * @param connection
 */
export function connect(connection: Connection) {
	const logger = getLogger(connection);
	const pubSub = getPubSub(connection);

	if (connection.raw?.readyState === WebSocket.OPEN) {
		logger.debug('Closing the existing connection');
		connection.raw.close();
	}

	const ws = new WebSocket(connection.url);

	connection.raw = ws;

	const timeoutID = setTimeout(() => {
		if (ws.readyState === WebSocket.CONNECTING) {
			logger.error(`Connection timeout while connecting to the server ${connection.url.toString()}`);
			ws.close();
		}
	}, connection[keys.connectionTimeoutMillis]);

	ws.addEventListener('open', (event) => {
		clearTimeout(timeoutID);
		logger.info(`Connected to ${connection.url.toString()}`);
		connection.state = WebSocket.OPEN;
		pubSub.dispatchEvent(new Event('open', event));
	});

	ws.addEventListener('close', (event) => {
		connection.state = WebSocket.CLOSING;
		clearTimeout(timeoutID);
		if (event.code === 1000) {
			logger.info(`Connection closed with code: %d, reason: %s`, event.code, event.reason);
		} else {
			logger.error(`Connection closed with code: %d, reason: %s`, event.code, event.reason);
		}
		pubSub.dispatchEvent(new CloseEvent('close', event));

		if (event.code === ABNORMAL_CLOSURE_CODE && connection[keys.attemptsLeft] > 0) {
			logger.info('Reconnecting');
			connection[keys.attemptsLeft] -= 1;
			reconnect(connection);
		} else {
			connection.state = WebSocket.CLOSED;
		}
	});

	ws.addEventListener('message', (event) => {
		// @ts-expect-error - readonly array is still an array
		pubSub.dispatchEvent(new MessageEvent('message', event));
	});

	ws.addEventListener('error', (event) => {
		clearTimeout(timeoutID);
		logger.error(event, 'Connection error');
		pubSub.dispatchEvent(new Event('error', event));
	});
}

export function close(connection: Connection, code?: number, reason?: string) {
	if (connection.raw) {
		connection.raw.close(code, reason);
	}
}

/**
 * Sends data to the server. Will throw an error if the connection is not open.
 * @param connection
 * @param data
 */
export function send(connection: Connection, data: string) {
	if (connection.raw) {
		connection.raw.send(data);
	}
}

/**
 * Registers an event listener on an internal event target. The listener is maintained when the connection is re-established.
 * When the reconnect happens, the listener will be triggered again
 * @param connection
 * @param type
 * @param listener
 * @param options
 */
export function addEventListener<K extends keyof WebSocketEventMap>(
	connection: Connection,
	type: K,
	listener: (ev: WebSocketEventMap[K]) => any,
	options?: boolean | AddEventListenerOptions,
): void;

export function addEventListener(
	connection: Connection,
	type: string,
	callback: EventListener,
	options?: boolean | AddEventListenerOptions,
) {
	getPubSub(connection).addEventListener(type, callback, options);
}

export function removeEventListener<K extends keyof WebSocketEventMap>(
	connection: Connection,
	type: K,
	listener: (ev: WebSocketEventMap[K]) => any,
	options?: boolean | EventListenerOptions,
): void;

export function removeEventListener(
	connection: Connection,
	type: string,
	callback: EventListener,
	options?: boolean | EventListenerOptions,
) {
	getPubSub(connection).removeEventListener(type, callback, options);
}

function getPubSub(connection: Connection): ConnectionEventTarget {
	return connection[keys.pubSub];
}

function getLogger(connection: Connection): Logger {
	return connection[keys.logger];
}

function getReconnectFn(connection: Connection): ReconnectFn {
	return connection[keys.reconnectFn];
}
