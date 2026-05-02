async function run() {
    const args = process.argv.slice(2);
    const exp = await import("../lib/index.mjs");
    const check = async (dir) => {
        const result = await exp.checkEntries(
            dir,
            process.env.DNS_API_TOKEN,
            process.env.ZONE_ID,
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
    };
    if (args.length === 1) {
        await check(args[0]);
    }
}
run()
    .then(() => { })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
