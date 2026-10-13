/** The ports `serve` passes on, read from the environment; the starter picks its own when absent. */
export const servePorts = (env: NodeJS.ProcessEnv): { port?: number; apiPort?: number } => {
  const out: { port?: number; apiPort?: number } = {};
  if (env.PORT !== undefined) out.port = Number(env.PORT);
  if (env.API_PORT !== undefined) out.apiPort = Number(env.API_PORT);
  return out;
};
