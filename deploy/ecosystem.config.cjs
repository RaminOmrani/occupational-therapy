// pm2 process definitions — both apps keep running and restart on reboot
module.exports = {
  apps: [
    { name: "clinic-api", cwd: __dirname + "/../apps/api", script: "pnpm", args: "start", env: { NODE_ENV: "production", PORT: "4000", TZ: "Asia/Tehran" }, max_memory_restart: "400M", time: true },
    { name: "clinic-web", cwd: __dirname + "/../apps/web", script: "pnpm", args: "start", env: { NODE_ENV: "production", PORT: "3000", TZ: "Asia/Tehran", API_URL: "http://127.0.0.1:4000" }, max_memory_restart: "600M", time: true },
  ],
};
