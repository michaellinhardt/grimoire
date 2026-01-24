/bmad:core:agents:bmad-master

# Context Gathering

Analyze and modify the sprint-runner system at: `_bmad/bmm/workflows/4-implementation/sprint-runner/`

Start by reading the README.md for system overview.

Read my request below and execute the workflow below.

# Request

I want to add a new improvement.

The purpose is to accelerate the workflow total time and improve the context accuracy and quality.

## Command initialization

Each commands start by an initialization, its the command file itself

Example: The command file for story-create is:

```story-create command file
---
description: 'Create the next user story from epics+stories with enhanced context analysis and direct ready-for-dev marking'
---

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS - while staying in character as the current agent persona you may have loaded:

<steps CRITICAL="TRUE">
1. Always LOAD the FULL @_bmad/core/tasks/workflow.xml
2. READ its entire contents - this is the CORE OS for EXECUTING the specific workflow-config @_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml
3. Pass the yaml path _bmad/bmm/workflows/4-implementation/create-story/workflow.yaml as 'workflow-config' parameter to the workflow.xml instructions
4. Follow workflow.xml instructions EXACTLY as written to process and follow the specific workflow config and its instructions
5. Save outputs after EACH section when generating any documents from templates
</steps>
```

All those steps can be done pragmatically to compute a string (dynamically per run). This string is the create-story-workflow instruction loaded by our script rather than from this file given to the agent. Instead of asking the agent to follow this setup instruction, the script do it, put in a string.

## Custom prompt for commands

We are not going to use the bmad command anymore, instead we will duplicate them, literally copy each commands folder we use in the workflow into a new command sprint-runner:[command-name].

After copying each command, we will modify them to merge our own prompt instruction per command with the command itself.

This will require to create new command, by duplicating one more some folder. Example:

- Duplicate create-story for sprint-runner:create-story, then for sprint-runner:review-story.
- ...

This will greatly improve the performance.

In this merge prompt, we remove instructions irrelevant, example, the steps to do the project discovery or to read the project context.

During analysis, You will have to carefully list all steps that should be removed, and all that should be added. Explain why. The purpose is to give less work to the agent.

Examaple: Since we inject project-context.md, we remove the step to read it. Or, in the review-story new command, we remove step about creating the story, we change them into review, with all the rule of review from our existing custom prompt.

Once done we will not need the prompt system files anymore, because the content will be in the new command itself.

Its very important to make the list of feature in the custom prompt and command carefully to not break anything existing, add checklist verifications for those, once we validated all.

Even the reporting of state from the subagent have to be documented in our new command.

## Using prompt system append

All the data that should be passed to the command, are injected to the prompt system with the flag appropriate to append.

We append the following data, with an appropriate structure (xml) and indicate file path for the one we dump from a file:
- custom command  (our own), already pre-setup, eg. the string `create-story-workflow`
- project-context.md
- discovery-project
- all artifacts generated during workflow, at the appropriate command
  - provide discovery tech spec when running command create-tech-spec
  - ...
-> the phylosophie is to reduce as much as possible the workfload of the subagent regarding to setup. Also adding it to prompt system enforce the data weight.

# Workflow

## Clarify & Validate

Clarify request: ask a series of question to clarify what needs to, continue until everything is clear.
- Be sure there is no gap in my explanation, some part i didnt explain, plan or forget
- Keep asking questions until all done, if new info added during question and need more question.. ask it!
- After questions, summarize the session and provide a checklist of what should be done
- Write a file that can be given to a subagent, explaining my initial request in its validated and consolidated version. this file will help the sub agent to have all info on what we work on. We name it `context file`

## Study

SubAgent task: Start a research command workflow.

Give path to `context file`

Task it to analyse the current command sprint-runner, the custom prompt for commands existing and the way we want to optimize it.

Following the same phylosophie, for each command we use in the loop, what could be moved to the system prompt and managed by the script, that we didnt mentioned yet ? List any discovery and save it into a file.

Once done we discuss those suggestion, you explain each, pros and cons, risk, how it optimize and i will decide if any is worth. then you save this we decided to keep into the `context file` and next step.

## PRD

SubAgent task: Start a prd command workflow.

Give path to `context file`

You communicate autonomously with the sub agent to obtain a prd dedicated to this `context file`.

Work autonomously until the file exist.

Instruct the subagent to only ask for human support if it discovery an important issue in the request.

## Autonomous Mode

From there, act as BMAD Master.

Use your workflow knowledge to spawn subagent and accomplish the implementation of all the changes.

Use the epics/story/techspec/dev-story/review etc.. You decide how it should be done with your knowledge on the BMAD method.

The implementation have to be reviewed twice.

We separate any server related from any markdown file related task. Server and commands: separate story. Document well upfront for each to know how to communicate per feature.

YOU NEVER execute a workflow yourself beside this one. You always use subagent.

You NEVER read the files written by subagent, you just get their feedback if success or not and spawn next command, always give content via file path. You MUST save your context for this long running workflow.

You pilote the flow until its implemented.

You will also update documentation of the command ( README.md etc.. )

At the end you 