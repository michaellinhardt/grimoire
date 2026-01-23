# Change sprint-runner command

I want to operate changes on the sprint-runner commands. I already made a research on various option to optimise, read the research:

`./_bmad-output/research/technical-sprint-runner-optimization-research-2026-01-23.md`

The command instructions is located in `./_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

`Desired Changes` describe the changes I selected to implement from the research.

Now You will operate this workflow:

1. Ask me as many questions you need to clarify until there is no gap or unknown left over or misunderstanding. Once clarify, output a clear report on the change request defined, save it for future agent.

2. Review my proposed solution, pros cons of each change, possible improvement related to those changes. We discuss it, eventually make change to the idea together, save any validated change in the request file. When ready move next

3. Suggest other idea that could really be helpful. We discuss it, if any validated, add to request.

Give the path of context file and other related files to the sub agents below:

4. Start a sub agent bmad master, task it to generate a list of changes + an implementation plan.

5. Start a sub agent bmad master to review this plan

6. Start a sub agent bmad master to implement this plan

7. Start a sub agent bmad master to review the implementation & fix if needed

# Desired Changes

Note: All script you create should be in the same folder _bmad/scripts/

## Manage orchestrator.md

This file Should have a better structure to be easily read by the dashboard.html file i created. It display the current activity from this file. Lets make a better structure.

First you create an SH script named `orchestrator.sh` which take arguments:
`orchestrator.sh [epic id] [story id] [command] [start or result]`

Example:

```
epic-1 2a.1 dev-story start
epic-1 2a.1 dev-story "All task comp.."
epic-1 2a.1 code-review start
epic-1 2a.1 code-review "lorem ipsum"
...
```

The header is not in the file, but its:

```
current unixtimestamp,epicid,storyid,command,result
```

result = "start" and its invoqued by orchestrator just before run the command
result = [real result] and its invoqued when the command is over, first action

the current unixtimestamp is added by the script.

The script append each entry as last line, this file have no header.

You note that we dont have step. its not usefull info for dashboard.


## Make Orchestrator lighter

In the instruction file given to the orchestrator, i want to remove the prompt (all the `<subagent-prompt for="xxx">`) and save this inside file that are passed to sub-agent as path.

## Model Routing

The orchestrator have to use Haiku for every review after the first one. Example:

- create-story Review 1 (default agent)
- create-story Review 2 (Haiku)
- create-story Review 3 (Haiku)

## Method 2: Better Upfront Specs Eliminate Rework

Follow the "how to do" instruction in this chapter of the file, it provide 2 checklist for creation mode of story and spec. To enforce the file creation.

## Improving Review Agent ( steps skip )

In the given file, look the chapter `Improving Review Agent ( steps skip )`

I want to implement this.

- The first run of create-story and tech-speac, the one who create the content. We instruct it to also create, respectively:
 `2a.1-discovery-story.md`
 `2a.2-discovery-story.md`
 `2a.1-discovery-tech.md` 
 `2a.2-discovery-tech.md` 

- The review agent will receive `2a.1-2a.2-discovery-project-level.md` + the file of discovery related to their workflow (story or tech).

- In the given prompt to the subagent, in the review mode, we strictly instruct to skip all steps related to discovery, plus any irrelevant steps for review specific.

## Script to refresh project context
- We an SH script inside _bmad/scripts/project-context-should-refresh.sh which return TRUE if the file project context does not exist, or older than 6 hours. When the script return true, it also delete the existing project context (if any) to force a new one being generated.

## Script to inject project context
- We create an SH script inside _bmad/scripts/project-context-injection.sh that take a file path as argument. In this file it search for the string `# Project Context Dump Below` which is the header of the content it will inject. If found, stop. Else It add the project context file to this one. It append it, starting by the following (you can rephrase):

```
# Project Context Dump Below
Below is the project context file located at `project context path`, don't read this file, its injected below.

[the file dump here]
```

## Step 0 before loop start, project context
- Before loop start, we start a sub-agent using the command to generate the project context. We instruct the sub-agent, to use the script, if true it generate the project context (or re-generate). It should not read the project context BEFORE using the script, ENFORCE this to avoid it to load the file that we are going to delete. project context this will be passed to all following agent in the loop.

## Cycle first step, context file with bmad master
- Before create-story we run subagent with command BMAD Master.
    - We instruct it to do the project discovery that will support the entire workflow to develop the stories X and Y in an automated AI workflow. Give him only relevant information.
    - It generate one implementation-artifact `2a.1-2a.2-discovery-project-level.md` (start with the id of stories) this will be passed to all following agent in the loop.
    - then it run the script _bmad/scripts/project-context-injection.sh on the generated file, it will inject the project context.
    - We pass this file to sub agent by path, to save orchestrator context
    - At the top of this file, is added separately the strict instruction to not do the project discovery and not read the project context since it will be injected in this file too.
    - BEWARE: BMAD Master is instructed to create a project level discovery HIGH. Nothing else in the file.

## Note on project context instruction for subagent
- The instruction to not read the project context is injected by the script SH to avoid writting it into each agent prompt.

## We run story by 2
- We will run 2 story in one loop, the current one and next one FROM SAME EPIC ONLY. if this is the last of an epic, it run alone. Important, if the batch size given by user is 1, we only run 1 story, when its more, like 2 or 5, we run 2 at a time as described. For 5 we would do -> 2, 2 and the last one alone. This ensure the user give a number which is the number of story to be completed, not the number of loop run.
- When an agent work on 2 story, it always start by the first one logically.

## All sub agent
All sub agent below will receive `2a.1-2a.2-discovery-project-level.md` path to read first, hopefully they dont do discovery or read project context.

## create-story 2 at a time
- create-story will write the 2 story, the first one, then the second one. Save in separated file of course, same as if it was doing one by one. Inside same agent to save overhead. This agent if receive only one story, then it write only for this one, obviously.

## All review agent
- The review agent work on both story as well, the first one, then the second one.

## Tech spec
- tech-spec will do the spec for the 2 story, the first one, then the second one.

## Code Dev & Review

The 2 story are implemented separatly, in order.

- Run the first code-story on the first story
- Run the review loop for this story
- Repeat with story 2

---

## Extra info

1. CSV log `orchestrator.md` (extention MD), is located in `implementation-artifacts` from bmad output.

2. dashboard.html Located in ./docs

3. The prompt file extracted from instructions.md are saved in a prompts folder inside the same folder of instructions.md

4. The Haiku routing is executed per workflow type / command. Its done regardless of the error level (critical or not) example:
create-story review 1 # normal
create-story review 2 # Haiky