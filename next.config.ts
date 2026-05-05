import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this app so a stray parent lockfile
  // does not confuse it with our pnpm workspace.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
