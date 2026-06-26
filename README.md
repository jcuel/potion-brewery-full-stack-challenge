# Potion Brewery Full Stack Challenge

![CI](https://github.com/jcuel/potion-brewery-full-stack-challenge/actions/workflows/ci.yml/badge.svg)

The goal of this repository is to provide us with a realistic setting to evaluate how you apply your experience, troubleshooting, AI fluency, and architectural judgment.

**AI use is permitted, just... use it to your real advantage**. Your job is to showcase your technical and critical-thinking abilities.

If you just send Claude off to handle everything, we learn nothing and have no grounds to advance you to the next steps.

This challenge comes in several stack flavors: React with a Node.js, Python, or .NET backend. Pick whichever you're most comfortable in; they're equivalent in scope and difficulty. Setup for each is at the bottom.

## Documentation (Node.js stack)

| Doc | Contents |
|-----|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, APIs, request flows, Docker topology |
| [BUGFIXES.md](./BUGFIXES.md) | Bugs fixed, test results, CI/Trivy pipeline |

## Tasks

Complete these in order:

### Bug 1

The alchemist profile's service date validation is broken.

### Bug 2

Dragging potion orders between production stages doesn't work.

### Feature

Allow alchemists to undo their potion order changes, with a preview of what would be undone before confirming and dealing with conflicts gracefully.

Your interviewer will take the role of product manager for this one: the line above is the starting point, and what "ideal" looks like is something you uncover by asking.

We're as interested in how you run that conversation as in the code you write.

Scope is yours to set (how many levels of undo, which actions are undoable), and we expect deliberate trade-offs. Depending on the time you have, either of these is a strong outcome:

- **Propose the design.** Lay out the architecture you'd build toward and defend it, even if you write little of it.
- **Build a slice.** Ship something working, and be explicit about what you chose to compromise on and why.

Reaching the "ideal" in the time given is rare; navigating toward it deliberately is the point.

## Setup

### React Frontend + Node.js Backend

**Requires:** Node 24+ and npm

```bash
npm run setup
npm start
```

**Docker (recommended for first run):**

```bash
docker compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
```

**Verify fixes (22 automated tests):**

```bash
docker compose up -d --build
npm run ci              # build + unit + integration smoke tests
npm run scan:trivy:library   # optional: app dependency scan
```

Pull requests receive an automated CI results comment. See [BUGFIXES.md](./BUGFIXES.md) for details.

### React Frontend + Python Backend

**Requires:** Node 24+, npm, and Python 3.10+

```bash
npm run setup:python
npm run start:python
```

### React Frontend + .NET Backend

**Requires:** Node 24+, npm, and .NET 10 SDK

```bash
npm run setup:dotnet
npm run start:dotnet
```
