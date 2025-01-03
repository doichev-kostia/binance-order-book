import { reactRouter } from "@react-router/dev/vite";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { reactRouterHonoServer } from "react-router-hono-server/dev";

export default defineConfig({
	css: {
		postcss: {
			plugins: [tailwindcss, autoprefixer],
		},
	},
	plugins: [
		reactRouterHonoServer({ runtime: "node", serverEntryPoint: "./workers/server.ts" }),
		reactRouter(),
		tsconfigPaths()
	],
});
