/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      {
        source: "/",
        destination: "/routes",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
