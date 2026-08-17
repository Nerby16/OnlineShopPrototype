import { spawn } from "node:child_process";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const commands = [
  {
    name: "tienda",
    args: [resolve(projectRoot, "node_modules/vinext/dist/cli.js"), "dev"],
  },
  {
    name: "API",
    args: [
      "--watch",
      "--env-file-if-exists=.env",
      resolve(projectRoot, "server/index.mjs"),
    ],
  },
];

console.log(`Usando ${process.version}. Iniciando Lúmina…`);

const children = commands.map(({ name, args }) => {
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });

  child.on("error", (error) => {
    console.error(`No se pudo iniciar ${name}:`, error.message);
    shutdown(1);
  });

  child.on("exit", (code) => {
    if (!stopping && code !== 0) {
      console.error(`${name} se detuvo con el código ${code}.`);
      shutdown(code ?? 1);
    }
  });

  return child;
});

let stopping = false;

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(code), 250);
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
