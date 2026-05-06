export function checkPrBody(body: string) {
  let status = true;
  const message: { passed: string; error: string } = {
    passed: `PR body checks are passed.`,
    error: "",
  };
  body = body.replace(/<!--[\s\S]*?-->/gm, "").trim();
  const unwrapAutolink = (value: string) =>
    value.replace(/^<([^>]+)>$/, "$1").trim();
  // Regexp
  const tncRegexp =
    /^\s*-\s*\[(\s*|x|X)?\]\s*I have read and accepted the \[Terms and Conditions\]\(https:\/\/github\.com\/phothinmg\/mmdevs\.org\/wiki\/Terms-and-Conditions\)\s*$/m;
  const rcRegexp =
    /^\s*-\s*\[(\s*|x|X)?\]\s*There is reasonable content on the page\s*$/m;
  const repoUrlRegexp = /^\s*Host repo of my page is\s*(.+)\s*$/m;
  const pageUrlRegexp = /^\s*The site content can be seen at\s*(.+)\s*$/m;

  // Matches
  const tncMatch = body.match(tncRegexp);
  const rcMatch = body.match(rcRegexp);
  const repoMatch = body.match(repoUrlRegexp);
  const pageMatch = body.match(pageUrlRegexp);

  if (!tncMatch) {
    status = false;
    message.error = `"Terms and Conditions" line is missing in PR body.`;
    return { status, message };
  }
  if (!rcMatch) {
    status = false;
    message.error = `"There is reasonable content on the page" line is missing in PR body.`;
    return { status, message };
  }
  if (!repoMatch) {
    status = false;
    message.error = `"Host repo of my page is" line is missing in PR body.`;
    return { status, message };
  }
  if (!pageMatch) {
    status = false;
    message.error = `"Host repo of my page is" line is missing in PR body.`;
    return { status, message };
  }
  // check [x]
  if (tncMatch && (!tncMatch[1] || (tncMatch[1] && !/x/i.test(tncMatch[1])))) {
    status = false;
    message.error = `In "Terms and Conditions" line need check([x])`;
    return { status, message };
  }
  if (rcMatch && (!rcMatch[1] || (rcMatch[1] && !/x/i.test(rcMatch[1])))) {
    status = false;
    message.error = `In "There is reasonable content on the page" line need check([x])`;
    return { status, message };
  }
  // repo url
  const repoUrlRawValue = repoMatch?.[1]?.trim();
  if (repoUrlRawValue) {
    if (/^<?repo_url>?$/i.test(repoUrlRawValue)) {
      status = false;
      message.error = `Replace placeholder value "<repo_url>" at "Host repo of my page is" line in PR body.`;
      return { status, message };
    }
    const value = unwrapAutolink(repoUrlRawValue);
    if (!/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i.test(value)) {
      status = false;
      message.error = `"<repo_url>" at "Host repo of my page is" line in PR body should be a GitHub repository URL like <https://github.com/{owner}/{repo}>.`;
      return { status, message };
    }
  }
  // site url
  const pageUrlValue = pageMatch?.[1]?.trim();
  if (pageUrlValue) {
    if (/^<?site_url>?$/i.test(pageUrlValue)) {
      status = false;
      message.error = `Replace placeholder value "<site_url>" at "The site content can be seen at" line in PR body.`;
      return { status, message };
    }
    const value = unwrapAutolink(pageUrlValue);
    if (!/^https?:\/\//i.test(value)) {
      status = false;
      message.error = `"<site_url>" at "The site content can be seen at" line in PR body should be a valid URL starting with http:// or https://. Markdown autolinks like <https://example.com> are allowed.`;
      return { status, message };
    }
  }
  return { status, message };
}
