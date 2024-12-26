import type { Route } from "./+types/home";
import { OrderBook } from "~/core/orderbook";
import { useEffect, useRef, useState } from "react";
import { atom, useAtomValue } from "jotai";

const ws = atom(new WebSocket("wss://stream.binance.com:9443/ws/solusdt@depth"));

export default function Home({ loaderData }: Route.ComponentProps) {
	const connection = useAtomValue(ws);
	const [orderBook, setOrderBook] = useState(OrderBook.list());

	useEffect(() => {
		const ac = new AbortController();
		OrderBook.attachListener(connection, ac.signal);

		connection.addEventListener("message", () => {
			setOrderBook(OrderBook.list());
		}, { signal: ac.signal });

		return () => {
			ac.abort();
		}
	}, [connection])

	return (
		<section data-page="home" className="container mx-auto">
			<header>
				<div>
					<h2 className="text-base text-center font-semibold text-gray-900">Order book</h2>
				</div>
			</header>
			<div className="mb-2">
				<h4 className="text-base text-gray-700">Asks</h4>
			</div>
			<div className="flow-root mb-8">
				<div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
					<div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
						<div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
							<table className="min-w-full divide-y divide-gray-300">
								<thead className="bg-gray-50">
									<tr>
										<th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
											Price
										</th>
										<th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
											Quantity
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200 bg-white">
									{orderBook?.a.map(([id, price, qty]) => (
										<tr key={id}>
											<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
												{price}
											</td>
											<td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{qty}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
			<div className="mb-2">
				<h4 className="text-base text-gray-700">Bids</h4>
			</div>
			<div className="flow-root">
				<div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
					<div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
						<div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
							<table className="min-w-full divide-y divide-gray-300">
								<thead className="bg-gray-50">
									<tr>
										<th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
											Price
										</th>
										<th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
											Quantity
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200 bg-white">
									{orderBook?.b.map(([id, price, qty]) => (
										<tr key={id}>
											<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
												{price}
											</td>
											<td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{qty}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
