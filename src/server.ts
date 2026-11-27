import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createContainer } from "./container.js";

const config = loadConfig();
const container = createContainer(config);
const app = createApp(container);

app.listen(config.PORT, () => {
  container.logger.info(`La Roulotte API : http://localhost:${config.PORT}`);
});
