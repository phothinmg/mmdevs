import { context, getOctokit } from "@actions/github";

export const createComment = (
	gh_token: string,
	repo_owner: string,
	gh_repo: string,
	pr_number: string,
) => {
	const github = getOctokit(gh_token);
	const commentToWF = async (comment_body: string, error: boolean) => {
		const isError = error ? "Error" : "Passed";
		const symbol = error ? "❌" : "✅";
		const runUrl = `${context.serverUrl}/${repo_owner}/${gh_repo}/actions/runs/${context.runId}`;
		//
		const { data: comments } = await github.rest.issues.listComments({
			owner: repo_owner,
			repo: gh_repo,
			issue_number: parseInt(pr_number, 10),
		});
		//
		const commentBody = `[${symbol}] Workflow ${isError} Report\n\nJob : ${context.job}\nMessage : ${comment_body}\nRun URL : ${runUrl}`;
		//
		const existing = [...comments].reverse().find((comment) => {
			const body = comment.body || "";
			return (
				comment.user?.type === "Bot" &&
				body.includes(`[${symbol}] Workflow ${isError} Report`)
			);
		}); //
		if (existing) {
			await github.rest.issues.updateComment({
				owner: repo_owner,
				repo: gh_repo,
				comment_id: existing.id,
				body: commentBody,
			});
		} else {
			await github.rest.issues.createComment({
				owner: repo_owner,
				repo: gh_repo,
				issue_number: parseInt(pr_number, 10),
				body: commentBody,
			});
		}
	}; // commentToWF
	return { commentToWF };
};

export async function checkUserLocation(
	gh_token: string,
	repo_owner: string,
	gh_repo: string,
	pr_number: string,
): Promise<void> {
	const github = getOctokit(gh_token);
	const { data: pr } = await github.rest.pulls.get({
		owner: repo_owner,
		repo: gh_repo,
		pull_number: parseInt(pr_number, 10),
	});
	//
	const username = pr.user.login;
	const { data: user } = await github.rest.users.getByUsername({
		username,
	});
	//
	const location = (user.location || "").toLowerCase();
	const createdComment = createComment(
		gh_token,
		repo_owner,
		gh_repo,
		pr_number,
	);
	if (!location.includes("myanmar")) {
		await createdComment.commentToWF(
			`❌ User ${username} must have location containing "Myanmar".\nCurrent profile location: "${user.location || "(empty)"}"`,
			true,
		);
		return;
	} else {
		await createdComment.commentToWF(
			`✅ PR user location is valid: ${user.location}`,
			false,
		);
		return;
	}
}
