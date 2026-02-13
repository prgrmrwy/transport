import pino from "pino";

const logger = pino({
  level: import.meta.env.DEV ? "debug" : "info",
  browser: {
    asObject: true,
  },
});

export default logger;
