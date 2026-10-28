// `npm run dev:test`: the dev server on a throwaway database (./.pglite-test),
// so manual or automated tests never touch your own local data.
import { spawn } from "node:child_process";

const env = { ...process.env, PGLITE_DIR: ".pglite-test" };

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit", shell: true });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed`))));
  });
}

await run("node", ["scripts/migrate.mjs"]);
await run("npx", ["next", "dev"]);
