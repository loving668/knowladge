from datetime import datetime, timedelta
from typing import List, Dict, Any

from ..core.wiki_engine import WikiEngine
from ..models.wiki_page import WikiPage, PageCategory, LintIssue, LintReport


class LintService:
    def __init__(self, wiki_engine: WikiEngine, outdated_days: int = 30):
        self.wiki = wiki_engine
        self.outdated_threshold = timedelta(days=outdated_days)

    def lint(self) -> LintReport:
        issues: List[LintIssue] = []

        issues.extend(self._check_orphan_pages())
        issues.extend(self._check_broken_links())
        issues.extend(self._check_outdated_pages())
        issues.extend(self._check_missing_tags())

        total_pages = len(self.wiki.get_all_pages())
        health_score = self._calculate_health_score(len(issues), total_pages)

        report = LintReport(
            health_score=health_score,
            issues=issues,
            total_pages=total_pages
        )

        self.wiki.append_log(
            "lint",
            f"Health Score: {health_score:.1f}%\nIssues Found: {len(issues)}\nTotal Pages: {total_pages}"
        )

        return report

    def _check_orphan_pages(self) -> List[LintIssue]:
        issues: List[LintIssue] = []
        all_pages = self.wiki.get_all_pages()

        for page in all_pages:
            backlinks = self.wiki.get_backlinks(page.slug)

            if not backlinks and page.category != PageCategory.QUERY:
                issues.append(LintIssue(
                    issue_type="orphan_page",
                    page_slug=page.slug,
                    description=f"Page '{page.title}' has no inbound links from other pages.",
                    severity="warning"
                ))

        return issues

    def _check_broken_links(self) -> List[LintIssue]:
        issues: List[LintIssue] = []
        all_pages = self.wiki.get_all_pages()
        existing_slugs = {p.slug for p in all_pages}

        for page in all_pages:
            linked_slugs = self.wiki.find_links(page.content)

            for linked_slug in linked_slugs:
                if linked_slug not in existing_slugs:
                    issues.append(LintIssue(
                        issue_type="broken_link",
                        page_slug=page.slug,
                        description=f"Link '[[{linked_slug}]]' points to non-existent page.",
                        severity="error"
                    ))

        return issues

    def _check_outdated_pages(self) -> List[LintIssue]:
        issues: List[LintIssue] = []
        now = datetime.now()

        for page in self.wiki.get_all_pages():
            age = now - page.frontmatter.updated_at

            if age > self.outdated_threshold:
                days_old = age.days
                issues.append(LintIssue(
                    issue_type="outdated_content",
                    page_slug=page.slug,
                    description=f"Page '{page.title}' hasn't been updated in {days_old} days.",
                    severity="info"
                ))

        return issues

    def _check_missing_tags(self) -> List[LintIssue]:
        issues: List[LintIssue] = []

        for page in self.wiki.get_all_pages():
            if not page.frontmatter.tags:
                issues.append(LintIssue(
                    issue_type="missing_tags",
                    page_slug=page.slug,
                    description=f"Page '{page.title}' has no tags.",
                    severity="warning"
                ))

        return issues

    def _calculate_health_score(self, issue_count: int, total_pages: int) -> float:
        if total_pages == 0:
            return 100.0

        error_weight = 3.0
        warning_weight = 1.0
        info_weight = 0.2

        weighted_issues = 0
        for issue in self.wiki.get_all_pages():
            pass

        max_score = total_pages * 10
        deduction = issue_count * 2

        score = max(0, 100 - (deduction / max_score * 100 * 10))
        return round(score, 1)

    def get_statistics(self) -> Dict[str, Any]:
        all_pages = self.wiki.get_all_pages()

        category_counts = {}
        for category in PageCategory:
            category_counts[category.value] = len(self.wiki.get_pages_by_category(category))

        total_links = 0
        for page in all_pages:
            total_links += len(self.wiki.find_links(page.content))

        return {
            "total_pages": len(all_pages),
            "by_category": category_counts,
            "total_links": total_links,
            "avg_links_per_page": total_links / len(all_pages) if all_pages else 0
        }

    def suggest_improvements(self) -> List[Dict[str, Any]]:
        suggestions = []
        report = self.lint()

        orphan_issues = [i for i in report.issues if i.issue_type == "orphan_page"]
        if orphan_issues:
            suggestions.append({
                "type": "fix_orphans",
                "priority": "high",
                "description": f"Add links to {len(orphan_issues)} orphan pages from related content",
                "pages": [i.page_slug for i in orphan_issues[:5]]
            })

        broken_issues = [i for i in report.issues if i.issue_type == "broken_link"]
        if broken_issues:
            suggestions.append({
                "type": "fix_broken_links",
                "priority": "critical",
                "description": f"Fix or create {len(broken_issues)} broken links",
                "pages": list(set(i.page_slug for i in broken_issues[:5]))
            })

        outdated_issues = [i for i in report.issues if i.issue_type == "outdated_content"]
        if outdated_issues:
            suggestions.append({
                "type": "update_content",
                "priority": "medium",
                "description": f"Review and update {len(outdated_issues)} outdated pages",
                "pages": [i.page_slug for i in outdated_issues[:5]]
            })

        return suggestions
