/bmad:core:agents:bmad-master

# Context Gathering

Analyze and modify the sprint-runner system at: `_bmad/bmm/workflows/4-implementation/sprint-runner/`

Start by reading the README.md for system overview.

Read my request below and execute the workflow below.

# Goal

In the sprint-runner command folder, I want to split the folder dashboard.

I want `server` folder and `frontend` folder.

in frontend folder, you create index.html to open the dashboard. However you split its code in multiple files, logically. you do the same for the server.

We will have 1 workflow managing parallels agent to implement separement the change for each folders.

DO NOT modify any business logic, function, features, unless its bugged. You just refacto to match the new architecture, everything works the same. We still may have to review path written in raw in various place. 

# Workflow

## Clarify

Discuss with me to clarify my question, ask as many questions as needed to be sure you understand my need.

## Change Context

Start sub agent project-context and ask it to generate a `change context`, to describe everything i requested after we clarified. This file should explain everything to study impact in next steps.

## Study

Sub agents here receive the path of `change context`

SubAgent researcher: Investigate the sprint-runner command's files related to the dashboard <=> server (not related to agent and system prompts/commands). Gather all information we will need to execute the change, describe what we may have to do, not too technical, just observing from collected data.

Parallel Subagent researcher: Same investigation and method but about server <=> spawn childe (commands, injections, MD files, related server code, etc..)

## Study Review

You run 2 sub agent for each study done, use the most appropriate commands from BMAD to request a review of the 2 past study, verify information given, check for improvement or error, gap etc.. fix anything. (parallel)

## Study Review Coherence

You run 1 sub agent, it review together the 2 study done. use the most appropriate commands from BMAD. The agent study the coherence of the 2 files, are they compatible, no mismatch, etc.. because we will deploy change separately, it have to match. Fix anything.

## Plan

1 sub agent per study, get the `change context`, write a plan on how to implement, include acceptance criteria, checklists to guide quality and completness. (parallel)

## Plan review

1 sub agent per plan to review and fix it. pick the command appropriate (parallel)

then (sequencial), one agent to review the coherence of the 2 plan together.

---

Repeat the process above with Haiku agent

## Implement

1 sub agent per plan, pick best command, implement (parallel).

## Implement Review

Copy process of `Plan review` but for code review.



