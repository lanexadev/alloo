/**
 * Conventional Commits, matching the history of this repository
 * (`feat:`, `fix:`, `refactor:` …). Enforced by the `commit-msg` hook.
 */
export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		// Room for a descriptive subject without encouraging paragraphs.
		"header-max-length": [2, "always", 100],
	},
};
