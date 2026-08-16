/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // نشر مضغوط مع خادم قائم بذاته (Docker/Railway)
};

export default nextConfig;
