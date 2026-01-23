# Changes

We work on the command sprint-runner in ./_bmad/bmm/workflows/4-implementation/sprint-runner and its HTML dashboard visualizer, the file ./docs/dashboard.html

I tested the command sprint-runner, there is problem related to the logging and dashboard.html.

You will run the workflow:

```
0. Discovery context in files
1. Ask clarification questions
1.1. identify gap, mistake, potential issue, improvement
2. generate 2 report to list change, one for the command sprint-runner, one for
dashboard.html
3. Task 2 sub agent: they plan respectively for sprint-runner and for dashboard.html ( include acceptance criteria and checklist verifications )
4. Task 2 sub agent: they implement each plan ( verify acceptance criteria and checklist, continue until all OK)
5. Task 2 sub agent: they review the work done
```

## Issue

Issue: First dashboard.html, the tab activity is not displaying any data.

## Changes

  - First we only log the id of epic and story. Example `234234234,2b,2b-6,create-story,[log message]` the log
  message is verbose but very concise, human readable.

  - the csv have one more column, BEFORE the message (result). The column is "duration", and is managed by the SH script. When en entry is added, it set the value of duration to 0. It also set the duration value of the previous task = timestamp column of the new entry, minus its timestamp (timestamp is first column). So the SH script calculate and right the duration of each task, based on the next one.

  - the csv also have one more column, after the command, which is "step" and used to describe the step of this command

  - Remove the instructions to call SH with "end" or "start" from everywhere

  - The dashboard can calculate the total time of a story by SUM all duration with this story ID. It can calculate duration of a command by SUM all duration with story ID + same command ID. Each command log multiple event with an unique ID

  - The csv main format should be respected, no data added without following this format

  - data added to csv have to be linked to story. "batch-start" is not, its not logged.

  - From now on, the orchestrator is not using the SH anymore, it should not even be mentioned
  at all in its instruction. Its only in the sub agent instruction. 
  
  - Sub agent are instructed to use the SH script as follow:
    - Sub agent use their command name and also unique identifier when they are in review loop example `story-review-[number]` as command. They also add a step to the log.
    - They log all main event, concisely describe what they do in the last argument. Main action include also discovery. Example:

  From create-story (first run, only 2 field for the example):
  command,result
  - create-story,discovery,discovering files to generate story
  - create-story,draft,draft a story
  - create-story,final,write final file
  - story-review-1,study,read the story file
  - ...

