import { files } from "@suseejs/files";

const bodyFile = "opt/body.mjs";
const userFile = "opt/user.mjs";
const entryFile = "opt/entry.mjs";

const bodyContent = `
async function run() {
    const exp = await import("../lib/index.mjs");
    await exp.checkPullRequestBody(
        process.env.GITHUB_TOKEN,
        process.env.REPO_OWNER,
        process.env.REPO_NAME,
        process.env.PR_NUMBER,
        process.env.PR_BODY,
    );
}
run()
    .then(() => { })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
`.trim();

const userContent = `
async function run() {
    const exp = await import("../lib/index.mjs");
    await exp.checkUserLocation(
        process.env.GITHUB_TOKEN,
        process.env.REPO_OWNER,
        process.env.REPO_NAME,
        process.env.PR_NUMBER,
    );
}
run()
    .then(() => { })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
`.trim();

const entryContent = `
async function run() {
    const args = process.argv.slice(2);
    const exp = await import("../lib/index.mjs");
    const checked = exp.checkEntryFile(
        process.env.GITHUB_TOKEN,
        process.env.REPO_OWNER,
        process.env.REPO_NAME,
        process.env.PR_NUMBER,
        process.env.GITHUB_USER,
        process.env.GITHUB_UID,
    );
    if (args.length === 1) {
        await checked.check(args[0]);
    }
}
run()
    .then(() => { })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });

`.trim();

await files.writeFile(bodyFile, bodyContent);
await files.writeFile(userFile, userContent);
await files.writeFile(entryFile, entryContent);
