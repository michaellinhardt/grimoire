/bmad:core:agents:bmad-master

# Context Gathering

Analyze and modify the sprint-runner system at: `_bmad/bmm/workflows/4-implementation/sprint-runner/`

Start by reading the README.md for system overview.

Read my request below and execute the workflow below.

# Workflow

## Study

THIS STEP IS A WORKFLOW TO RUN IN PARALLEL OF THE REST OF THE WORKFLOW. EVERY STEPS IS TO CONTINUE WHILE YOU DO THE OTHER STEPS BELOW, IN PARALLEL.

### Research agent

Start a sub agent research command.

Focus: UI/UX of dashboard sprint run, for user

The agent need to study how works the tool, what data is associated with a running workflow and how to re-organize the sprint runner tab display, to have full details about the bash done and currently running. It display the current by default with a list of all past batch run, click on a past run display it. The batch display show all info about a batch, the epics, the stories, the commands, the messages, the time spend. Its animated to show what's run. I want a UI/UIX at the level of a company like Apple or Anthropic.

Write a file with all the ideas, suggestion, design style, etc.. everything as a brainstorm on how to improve this page.

### Analyze agent

Sub Agent UI/UX.

Mission to review the previous file, study each option, pros and cons, and analyze with the point of view of the user in mind.

The user want to have a fast way to start the run, keep the page open so the user can monitor at ANY time whats happen, in real time, and can have absolutely all information about the batch running/past and their story etc.. within this one page. Its animated, not compacted but not too spacious because we have many info to display. Its a technical product used by tech-user so it dont have to be too simple, we can afford complexity. Imagine you are Steve Jobs, thinking for the user.

Once done you make a report of how should looks like the new UI/UX, you write all the documentation to support the development.

The `Study` workflow is completed here.

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

## Pilote the development of UI/UX changes

**Wait to have the UI/UX file ready to start this step.**

From there, act as BMAD Master.

Use your BMAD method knowledge to spawn subagent and accomplish the implementation of all the changes from UI/UX file.

Use the epics/story/techspec/dev-story/review etc.. You decide how it should be done with your knowledge on the BMAD method.

The implementation have to be reviewed twice, second review with Haiku.

YOU NEVER execute a workflow yourself beside this one. You always use subagent.

You NEVER read the files written by subagent, you just get their feedback if success or not and spawn next command, always give content via file path. You MUST save your context for this long running workflow.

You pilote the flow until its implemented.

You will also update documentation of the command ( README.md etc.. )