async function run() {
    const exp = await import("../lib/index.mjs");
    await exp.checkEntries(
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
