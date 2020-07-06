
import { config, env, setupENV } from './config';

export const preflightChecks = (env: env = config.get("env") || "prod") => {
  setupENV(env)

  // version check

  // token check or setup


}
