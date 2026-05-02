async function run() {
    const exp = await import("../lib/index.mjs");
    const result = await exp.checkPrBody(
        process.env.GITHUB_TOKEN,
        process.env.REPO_OWNER,
        process.env.REPO_NAME,
        process.env.PR_NUMBER,
    );
    if (!result.status) {
        console.error(result.message);
        process.exit(1);
    } else {
        console.log(result.message);
    }
}
run()
    .then(() => { })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
