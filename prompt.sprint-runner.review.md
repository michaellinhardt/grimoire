/bmad:core:agents:bmad-master

# Context Gathering

Analyze and modify the sprint-runner system at: `_bmad/bmm/workflows/4-implementation/sprint-runner/`

Start by reading the README.md for system overview.

Read my request below and execute the workflow below.

# Workflow

## Review

We need to review the current work done.

I just finish an implementation.

Start a sub agents to review the entire command. This agent focus is about the prompts and the script that run the subagents.
Start in parallel a sub agents to review the entire command. This agent focus on the dashboard tab to run server and the communication and data exchange between dashboard and backend and the coherence in data between all the command.

The 2 agents write there discovery in a file.

It write the errors found, why its an error, how it could be fixed.

Once done you summarize the discovery.

## Plan 

Start 2 sub agent to write to implementation plan for each part.

## Plan Review

Start one subagent to review plan 1 and fix if needed
Start one subagent to review plan 2 and fix if needed
When done, Start one subagent to review the 2 plan at once, it focus on coherence between the 2 plan, insure there is no conflict or data mismatch etc.. fix if needed

## Repeat Review

Sub agent to repeat the review process, this time with Haiku

## Implementation

Start one subagent to implement plan 1
Start one subagent to implement plan 2

When done, Start one subagent per implementation to review and fix.
Repeat a second time with Haiku sub agents.

One last review fix with an agent, it review the 2 implementation at once, to identify mismatch between both, gap etc.. it focus on relationship of the two implementation.

## Move Artifacts

Move all generated implementation artifacts inside `archived-artifacts` from sprint-runner command folder.

