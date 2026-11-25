import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createContainer } from "./container.js";

const config = loadConfig();
const app = createApp(createContainer(config));

app.listen(config.PORT, () => {
  console.log(`La Roulotte API : http://localhost:${config.PORT}`);
});
