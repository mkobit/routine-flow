---
title: Priority dispatch and multi-property filtering
type: dashboard
tags:
  - routine-flow
  - priority-dispatch
  - bases-filters
---

# Multi-property task queue filtering and priority dispatch

This dashboard demonstrates multi-property task filtering and priority-driven dispatch across routine timer engines.
Obsidian Bases dynamically queries note metadata (combining priority levels, tags, lifecycle status, folder paths, and due dates) before passing matching tasks to Routine Flow.
Routine Flow then orders candidates by `routine-priority` and drives phase execution.

## Top priority sprint focus

This view filters for in-progress tasks, sorted by routine dispatch priority.
Tasks with numeric `routine-priority` frontmatter values are prioritized over unranked items.

![[Priority-Queue.base#P1 urgent sprint focus]]

---

## High-severity bug triage lane

This view isolates bug tickets requiring immediate triage sprints.
The routine executes in 15-minute sprints with automatic wrap-up when all triage tickets are resolved.

![[Priority-Queue.base#High priority bug blitz]]

---

## Deep work and morning priority lanes

These views separate ultradian deep work blocks from morning kickoff priority items.

### Ultradian deep work

![[Priority-Queue.base#Deep work top priority]]

### Morning kickoff sprint

![[Priority-Queue.base#Morning priority launch]]

---

## Task queue and analytics overview

### Live task queue

![[Priority-Queue.base#Task queue and priority status]]

### Completed sessions by priority

![[Priority-Queue.base#Sessions by priority]]

### Routine status distribution

![[Priority-Queue.base#Routine status distribution]]
