export function checkPrRequestBody(body: string) {
  let status = true;
  let message: { passed: string; error: string[] } = {
    passed: `✅ PR body checks are passed.`,
    error: [],
  };
  body = body.replace(/<!--[\s\S]*?-->/gm, "").trim();
  const unwrapAutolink = (value: string) =>
    value.replace(/^<([^>]+)>$/, "$1").trim();
  // Regexp
  const tncRegexp =
    /^\s*1\.\s*\[(\s*|x|X)?\]\s*I have read and accepted the \[Terms and Conditions\]\(https:\/\/github\.com\/phothinmg\/mmdevs\.org\/wiki\/Terms-and-Conditions\)\s*$/m;
  const rcRegexp =
    /^\s*2\.\s*\[(\s*|x|X)?\]\s*There is reasonable content on the page\s*$/m;
  const repoUrlRegexp = /^\s*3\.\s*Host repo of my page is\s*(.+)\s*$/m;
  const pageUrlRegexp = /^\s*4\.\s*The site content can be seen at\s*(.+)\s*$/m;
  // Matches
  const tncMatch = body.match(tncRegexp);
  const rcMatch = body.match(rcRegexp);
  const repoMatch = body.match(repoUrlRegexp);
  const pageMatch = body.match(pageUrlRegexp);
  // Falsely message=
  if (!tncMatch) {
    status = false;
    message.error.push(`❌ "Terms and Conditions" line is missing in PR body.`);
  }
  if (!rcMatch) {
    status = false;
    message.error.push(
      `❌ "There is reasonable content on the page" line is missing in PR body.`,
    );
  }
  if (!repoMatch) {
    status = false;
    message.error.push(
      `❌ "Host repo of my page is" line is missing in PR body.`,
    );
  }
  if (!pageMatch) {
    status = false;
    message.error.push(
      `❌ "Host repo of my page is" line is missing in PR body.`,
    );
  }
  // check [x]
  if (tncMatch && (!tncMatch[1] || (tncMatch[1] && !/x/i.test(tncMatch[1])))) {
    status = false;
    message.error.push(`❌ In "Terms and Conditions" line need check([x])`);
  }
  if (rcMatch && (!rcMatch[1] || (rcMatch[1] && !/x/i.test(rcMatch[1])))) {
    status = false;
    message.error.push(
      `❌ In "There is reasonable content on the page" line need check([x])`,
    );
  }
  // repo url
  const repoUrlRawValue = repoMatch && repoMatch[1]?.trim();
  if (repoUrlRawValue) {
    if (/^<?repo_url>?$/i.test(repoUrlRawValue)) {
      status = false;
      message.error.push(
        `❌ Replace placeholder value "<repo_url>" at "Host repo of my page is" line in PR body.`,
      );
    }
    const value = unwrapAutolink(repoUrlRawValue);
    if (!/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i.test(value)) {
      status = false;
      message.error.push(
        `❌ "<repo_url>" at "Host repo of my page is" line in PR body should be a GitHub repository URL like <https://github.com/{owner}/{repo}>.`,
      );
    }
  }
  // site url
  const pageUrlValue = pageMatch && pageMatch[1]?.trim();
  if (pageUrlValue) {
    if (/^<?site_url>?$/i.test(pageUrlValue)) {
      status = false;
      message.error.push(
        `❌ Replace placeholder value "<site_url>" at "There is reasonable content on the page" line in PR body.`,
      );
    }
    const value = unwrapAutolink(pageUrlValue);
    if (!/^https?:\/\//i.test(value)) {
      status = false;
      message.error.push(
        `❌ "<site_url>" at "There is reasonable content on the page" line in PR body should be a valid URL starting with http:// or https://. Markdown autolinks like <https://example.com> are allowed.`,
      );
    }
  }
  return { status, message };
}
