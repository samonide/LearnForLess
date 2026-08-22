import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Uploads are promised "up to 500 MB" in the UI (lesson files,
      // course .db imports, thumbnails). The default Server Action
      // body cap is 1MB; 525mb leaves headroom for multipart overhead.
      bodySizeLimit: "525mb",
    },
  },
};

export default nextConfig;
