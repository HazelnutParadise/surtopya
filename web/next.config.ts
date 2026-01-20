/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Map internal env vars to public ones if needed
    PUBLIC_API_URL: process.env.PUBLIC_API_URL,
  },
};

export default nextConfig;
