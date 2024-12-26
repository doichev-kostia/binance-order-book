import { parseArgs } from "node:util"
import { z } from "zod"
import { BinaryHeap, descend, ascend } from "@std/data-structures";
import { assert } from "@std/assert";

const Options = z.object({
	values: z.object({
		uri: z.string()
	}),
});

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
		// TODO: Intl.NumberFormat()
		return (value / 10).toFixed(2);
	}


	public static shouldRemove(qty: number) {
		return qty === 0;
	}

	public static rows = 5;

	// TODO: accept the out stream
	public static display(orderbook: OrderBook) {
		const asks = new Array<string>(OrderBook.rows);
		for (let i = OrderBook.rows - 1; i >= 0; i -= 1) {
			const price = orderbook.bestSells.pop() || 0;
			const qty = orderbook.asks.get(price);
			assert(qty != null, "There always should be a quantity associated");
			asks[i] = OrderBook.format(price) + " " + OrderBook.format(qty);
		}
		const bids = new Array<string>(OrderBook.rows);
		for (let i = 0; i < OrderBook.rows; i += 1) {
			const price = orderbook.bestBids.pop() || 0;
			const qty = orderbook.bids.get(price);
			assert(qty != null, "There always should be a quantity associated");

			bids[i] = OrderBook.format(price) + " " + OrderBook.format(qty);
		}

		console.log("------------------")
		console.log("Order book");
		console.log("Asks");
		console.log("Price | Quantity");
		console.log(asks.join("\n"));
		console.log("Bids");
		console.log("Price | Quantity");
		console.log(bids.join("\n"));
		console.log("------------------")
		console.log("------------------")
	}
}

/**
* TODO:
- Create an orderbook
- update it based on the messages
- print the best 5 bids and offers
*/


async function run(args: string[]): Error | null {
	const { values } = Options.parse(parseArgs({
		args: args.slice(2),
		options: {
			uri: {
				type: "string"
			}
		}
	}));

	const ws = new WebSocket(values.uri);

	const orderbook = new OrderBook();

	ws.addEventListener("error", ev => {
		console.error(ev);
	})

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
		console.log(validation.data)
		OrderBook.display(orderbook);
	});

	return null;
}


async function main() {
	const err = await run([
		"",
		"",
		"--uri",
		"wss://stream.binance.com:9443/ws/solusdt@depth",
	]);

	if (err != null) {
		console.error(err);
		process.exit(1);
	}


}

void main();
