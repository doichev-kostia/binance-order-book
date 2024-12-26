import { reactRouter } from "@react-router/dev/vite";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { reactRouterHonoServer } from "react-router-hono-server/dev";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";

export default defineConfig({
	css: {
		postcss: {
			plugins: [tailwindcss, autoprefixer],
		},
	},
	plugins: [
		cloudflareDevProxy(),
		reactRouterHonoServer({ runtime: "cloudflare", serverEntryPoint: "./workers/server.ts" }),
		reactRouter(),
		tsconfigPaths()
	],
});
