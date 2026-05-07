import { checkEntries } from "./entries.js";
import { checkUserLocation, createComment } from "./github.js";
import { checkPrBody } from "./pr_body.js";

async function checkPullRequestBody(
  gh_token: string,
  repo_owner: string,
  gh_repo: string,
  pr_number: string,
  pr_body: string,
): Promise<void> {
  const commentCreator = createComment(
    gh_token,
    repo_owner,
    gh_repo,
    pr_number,
  );
  const checked = checkPrBody(pr_body);
  if (!checked.status) {
    await commentCreator.commentToWF(checked.message.error, true);
    return;
  } else {
    await commentCreator.commentToWF(checked.message.passed, false);
    return;
  }
}
//
function checkEntryFile(
  gh_token: string,
  repo_owner: string,
  gh_repo: string,
  pr_number: string,
  gh_user: string,
  gh_id: number,
): {
  check: (entryDir: string) => Promise<void>;
} {
  const commentCreator = createComment(
    gh_token,
    repo_owner,
    gh_repo,
    pr_number,
  );
  const check = async (entryDir: string) => {
    const checked = await checkEntries(entryDir, gh_user, gh_id);
    if (!checked.status) {
      await commentCreator.commentToWF(checked.message.error, true);
      return;
    } else {
      await commentCreator.commentToWF(checked.message.passed, false);
      return;
    }
  };
  return { check };
}

//
export { checkEntryFile, checkPullRequestBody, checkUserLocation };
