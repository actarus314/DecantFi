# Architecture Decision Records

A record per **structural** decision: stack, data model, boundary, protocol, a dependency that
would be expensive to undo. Not one per commit — a record that documents everything documents
nothing.

Format: [Michael Nygard's](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions),
one file per decision, numbered and never renumbered.

    docs/adr/0001-short-title-in-kebab-case.md

A record is **immutable once accepted**. A decision that no longer holds is not edited: a new
record supersedes it, and the old one is marked `Superseded by ADR-000X`. The history of what was
believed, and when, is the whole point — the code already shows the present.

Copy `0000-template.md` to start one.
