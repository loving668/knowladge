from pathlib import Path
from typing import Optional


DEFAULT_AGENTS_MD = """# AGENTS.md - Global Behavior Rules

You are an intelligent wiki assistant that maintains a structured knowledge base.

## Core Principles

1. **Quality over Quantity**: Every page should be concise and valuable
2. **Explicit Links**: Use `[[page-slug]]` syntax for cross-references
3. **Consistent Structure**: Follow templates for each page category

## Workflows

### Ingest Workflow
1. Read the source document carefully
2. Generate a concise summary (300-500 words)
3. Extract entities (people, organizations, projects)
4. Extract concepts (ideas, theories, methods)
5. Create/update relevant pages with bidirectional links
6. Update index.md

### Query Workflow
1. Search wiki pages using keywords
2. Read relevant pages
3. Synthesize answer with citations
4. If valuable, archive as new query page

### Lint Workflow
1. Check for orphan pages (no inbound links)
2. Check for broken links
3. Check for outdated content (>30 days)
4. Check for contradictions between pages
5. Generate health report

## Output Format

- Use Markdown formatting
- Include YAML frontmatter
- Use `[[slug]]` for internal links
- Keep summaries under 500 words
"""


DEFAULT_SCHEMA_MD = """# SCHEMA.md - Instance-Specific Constraints

## Page Categories

| Category | Directory | Purpose |
|----------|-----------|---------|
| entities | entities/ | People, organizations, projects |
| concepts | concepts/ | Ideas, theories, methods |
| summaries | summaries/ | Source document summaries |
| synthesis | synthesis/ | Cross-document analysis |
| queries | queries/ | Archived Q&A |

## Page Templates

### Entity Page
```markdown
---
title: Entity Name
category: entities
tags: [tag1, tag2]
---

## Overview
[Brief description]

## Key Information
- **Type**: [person/organization/project]
- **Related**: [[related-entity]]

## Notes
[Additional details]
```

### Concept Page
```markdown
---
title: Concept Name
category: concepts
tags: [tag1, tag2]
---

## Definition
[Clear definition]

## Key Points
- Point 1
- Point 2

## Related Concepts
- [[concept-1]]
- [[concept-2]]

## Sources
- [[summary-source-1]]
```

### Summary Page
```markdown
---
title: Source Title
category: summaries
source_id: [unique-id]
source_url: [original-url]
tags: [tag1, tag2]
---

## Summary
[300-500 word summary]

## Key Takeaways
1. Takeaway 1
2. Takeaway 2

## Entities Mentioned
- [[entity-1]]
- [[entity-2]]

## Concepts Introduced
- [[concept-1]]
```

## Quality Standards

- Summary length: 300-500 words
- Entity descriptions: 100-300 words
- Concept definitions: 200-400 words
- All pages must have at least one tag
- All pages should link to related content

## Archive Thresholds

- Query archive: Answer > 200 words AND contains new insights
- Outdated threshold: 30 days without update
- Orphan threshold: No inbound links
"""


class SchemaManager:
    def __init__(self, wiki_dir: Path):
        self.wiki_dir = wiki_dir
        self.agents_path = wiki_dir / "AGENTS.md"
        self.schema_path = wiki_dir / "SCHEMA.md"

    def get_agents_content(self) -> str:
        if self.agents_path.exists():
            return self.agents_path.read_text(encoding="utf-8")
        return DEFAULT_AGENTS_MD

    def get_schema_content(self) -> str:
        if self.schema_path.exists():
            return self.schema_path.read_text(encoding="utf-8")
        return DEFAULT_SCHEMA_MD

    def set_agents_content(self, content: str) -> None:
        self.agents_path.write_text(content, encoding="utf-8")

    def set_schema_content(self, content: str) -> None:
        self.schema_path.write_text(content, encoding="utf-8")

    def build_system_prompt(self, task_instruction: str = "") -> str:
        parts = [
            "You are an intelligent wiki assistant.",
            "You MUST follow the rules and conventions defined below.",
            "",
            "--- AGENTS.md (Global Behavior Rules) ---",
            self.get_agents_content(),
            "",
            "--- SCHEMA.md (Instance-Specific Constraints) ---",
            self.get_schema_content(),
        ]
        if task_instruction:
            parts.append("")
            parts.append("--- Current Task ---")
            parts.append(task_instruction)
        return "\n".join(parts)

    def initialize_schema(self) -> None:
        if not self.agents_path.exists():
            self.set_agents_content(DEFAULT_AGENTS_MD)
        if not self.schema_path.exists():
            self.set_schema_content(DEFAULT_SCHEMA_MD)
