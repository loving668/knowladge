# SCHEMA.md - Instance-Specific Constraints

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
