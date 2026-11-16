import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "5mb" }, // soportes de hasta 4 MB
  },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  // Prisma (engineType "client") lee su compilador WASM con fs en tiempo de ejecución;
  // Next no lo detecta solo, así que se incluye explícitamente en todas las funciones.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.prisma/client/query_compiler_bg.wasm", "./node_modules/.prisma/client/schema.prisma"],
  },
};

export default nextConfig;
