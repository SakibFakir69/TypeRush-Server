import type { Server } from "node:http";

import { mainServerApp } from "./index.js";
import { redis } from "../config/redis-config.js";
import { ablyRealtime } from "../config/ably-config.js";
import { setupSwagger } from "../docs/swagger.config.js";
import { startMatchmakingWorker } from "./modules/battle/matchmaking/matchmaking.worker.js";

if (!process.env.PORT) {
  throw new Error("Please provide port number");
}
const PORT = process.env.PORT as unknown as number;
let server: Server;

// RUN SERVER HERE
(() => {
  try {
    server = mainServerApp.listen(PORT, () => {
      redis.on("connect", () => {
        console.log("[ REDIS CONNECTED ]");
      });

      // START MATCHMAKING WORKER — needs the Realtime connection open first
      ablyRealtime.connection.once("connected", () => {
        startMatchmakingWorker();
        console.log("[ MATCHMAKING WORKER STARTED ]");
      });

      // SETUP SWAGGER UI
      setupSwagger(mainServerApp);
      console.log(` [ SERVER RUNNING ON THIS PORT ] :  ${PORT}`);
    });
  } catch (error) {
    console.log(error);
  }
})();

// HANDLE PROCESS
process.on("SIGINT", () => {
  server.close(() => {
    process.exit(1);
  });
  console.log(" [ SERVER CLOSED ] ");
});
process.on("SIGTERM", () => {
  server.close(() => {
    process.exit(1);
  });
  console.log(" [ SERVER CLOSED ]");
});