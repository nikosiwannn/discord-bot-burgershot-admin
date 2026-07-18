import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "discord.js",
    "@discordjs/ws",
    "@discordjs/rest",
    "@discordjs/builders",
    "@discordjs/collection",
    "@discordjs/formatters",
    "@discordjs/util",
    "zlib-sync",
    "bufferutil",
    "utf-8-validate",
    "erlpack",
  ],
};

export default nextConfig;
