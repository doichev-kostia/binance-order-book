import { z } from "zod"
import { BinaryHeap, descend, ascend } from "@std/data-structures";
import { ulid } from "@std/ulid";

export module OrderBook {
	const formatter = new Intl.NumberFormat();
	export const T = z.object({
		b: z.array(z.tuple([z.string().describe("ulid"), z.string().describe("level"), z.string().describe("if 0 - remove")])),
		a: z.array(z.tuple([z.string().describe("ulid"), z.string().describe("level"), z.string().describe("if 0 - remove")])),
	});

	export type T = z.infer<typeof T>;

	const OrderBookUpdate = z.object({
		b: z.array(z.tuple([z.string().describe("level"), z.string().describe("if 0 - remove")])),
		a: z.array(z.tuple([z.string().describe("level"), z.string().describe("if 0 - remove")])),
	});

	class OrderBook {
		bestBids = new BinaryHeap<number>(descend);
		bestSells = new BinaryHeap<number>(ascend);

		bids: Map<number, number> = new Map<number, number>();
		asks: Map<number, number> = new Map<number, number>();

		public static base = 10;

		public static normalize(value: string) {
			return Number(value) * OrderBook.base;
		}

		public static format(value: number): string {
			return formatter.format(value / OrderBook.base);
		}


		public static shouldRemove(qty: number) {
			return qty === 0;
		}

		public static rows = 5;
	}

	async function reconnect(): Promise<URLSearchParams> {
		return new URLSearchParams();
	}


	const orderbook = new OrderBook();

	export const pubsub = new EventTarget();


	export function attachListener(ws: WebSocket, signal: AbortSignal) {
		ws.addEventListener("error", ev => {
			console.error(ev);
		}, { signal })

		ws.addEventListener('message', function message(ev) {
			const json = JSON.parse(ev.data);
			const validation = OrderBookUpdate.safeParse(json);
			if (validation.success === false) {
				console.error("Validation failed", validation.error);
				return;
			}
			const length = Math.max(validation.data.b.length, validation.data.a.length);

			for (let i = 0; i < length; i += 1) {
				if (validation.data.b[i]) {
					const tuple = validation.data.b[i];
					const level = OrderBook.normalize(tuple[0]);
					const qty = OrderBook.normalize(tuple[1]);

					if (OrderBook.shouldRemove(qty)) {
						orderbook.bids.delete(level);
					} else {
						orderbook.bestBids.push(level);
						orderbook.bids.set(level, qty);
					}
				}

				if (validation.data.a[i]) {
					const tuple = validation.data.a[i];
					const level = OrderBook.normalize(tuple[0]);
					const qty = OrderBook.normalize(tuple[1]);

					if (OrderBook.shouldRemove(qty)) {
						orderbook.asks.delete(level);
					} else {
						orderbook.bestSells.push(level);
						orderbook.asks.set(level, qty);
					}
				}
			}
			pubsub.dispatchEvent(new MessageEvent("refresh"))
		}, { signal });
	}

	export function list(): T {
		const asks = new Array<[string, string, string]>(OrderBook.rows);
		for (let i = OrderBook.rows - 1; i >= 0; i -= 1) {
			const price = orderbook.bestSells.pop() || 0;
			const qty = orderbook.asks.get(price) || 0;
			asks[i] = [ulid(), OrderBook.format(price), OrderBook.format(qty)];
		}
		const bids = new Array<[string, string, string]>(OrderBook.rows);
		for (let i = 0; i < OrderBook.rows; i += 1) {
			const price = orderbook.bestBids.pop() || 0;
			const qty = orderbook.bids.get(price) || 0;

			bids[i] = [ulid(), OrderBook.format(price), OrderBook.format(qty)];
		}

		return {
			a: asks,
			b: bids
		}
	}
}
