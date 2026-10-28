// `npm run dev:test`: the dev server on a throwaway database (./.pglite-test),
// so manual or automated tests never touch your own local data.
import { spawn } from "node:child_process";

// AI_MOCK: the AI pipeline runs end to end with deterministic local stand-ins.
const env = { ...process.env, PGLITE_DIR: ".pglite-test", AI_MOCK: process.env.AI_MOCK ?? "1" };

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit", shell: true });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed`))));
  });
}

await run("node", ["scripts/migrate.mjs"]);
await run("npx", ["next", "dev"]);
