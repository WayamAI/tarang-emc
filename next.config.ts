import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev badge sits on top of the sidebar's Settings control.
  devIndicators: false,
  // Pin the workspace root so a lockfile higher up the tree is not picked.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
