import { createHonoServer } from "react-router-hono-server/node";
import { Hono, type Context } from "hono";
import { type ServerBuild } from "react-router";


/* type your Cloudflare bindings here */
type Bindings = {};

/* type your Hono variables (used with c.get/c.set) here */
type Variables = {};

type ContextEnv = { Bindings: Bindings; Variables: Variables };

export function getLoadContext(c: Context, options: { build: ServerBuild; mode: string; }) {
	const { build, mode } = options;

	return {
		// Nice to have if you want to display the app version or do something in the app when deploying a new version
		// Exemple: on navigate, check if the app version is the same as the one in the build assets and if not, display a toast to the user to refresh the page
		// Prevent the user to use an old version of the client side code (it is only downloaded on document request)
		appVersion: mode === "production" ? build.assets.version : "dev",
	};
}

declare module "react-router" {
	export interface AppLoadContext extends Awaited<ReturnType<typeof getLoadContext>> {
	}
}

const server = await createHonoServer<ContextEnv>({
	host: "0.0.0.0",
	useWebSocket: false,
	configure(server) {
		server.get("/ping", async c => c.text("pong"));
		/* Cloud Run */
		server.get("/ready", async c => c.text("ok"));
		/* Cloud Run */
		server.get("/health", async c => c.text("ok"));
	},
	getLoadContext,
});


export default server;
