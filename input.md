/bmad:core:agents:bmad-master

# Instruction

Analyse my command sprint-runner, the associated file sprint-runner.csv and
the dashboard.html with its python server.

Read my request below and execute the workflow below.

# Request

I am considering to attempt an improvement by totally removing the Orchestrator, the main instance that runs all sub-agent.

You will study the instructions.md of the orchestrator and see if we could pragmatically scripted this part of the workflow.

The idea would be to run a nodejs script, or python, maybe even the same python used for dashboard.html to have real time preview.

The script would operate the orchestrator steps

Idea about tracking: The script use sprint-runner.json to save all its states and workflow states. When start it load the file, use in memory data to run its logic, and update sprint-runner.json at each changes to preserve states in crash.

The script use an SQLLite database to save every batch states, stories, commands, etc.. it keeps record of all batch that had run. We save eveyrhting we can in a well split and structured database. The dashboard will be able to use it.

The script run commands by spawning claude code with live stream json and silent mode.

we instruct the command's workflow to print specific json info, easy to parse, that replace the usage of the SH script. Our nodejs script is reading the stream output and parse each message to identify trigger patterns. When he see the specific output related to logging, it will write the start and end. We can use a more optimized data structure, such as one entry per command with one field for start timestamp and one for end timestamp.

In order to make it reliable, we have to ensure all task-id is fixed in a file so the script have no doubt on what to look for.

Also make the dashboard full width, not centered on the browswer.

# Workflow

## Clarify

Clarify request: ask a series of question to clarify what needs to, continue until everything is clear.

## Study Orchestrator

SubAgent task: Study instructions.md from sprint-runner command.

List in a file the entire workflow from orchestrator point of view. 

All the event/actions/conditions that occurs, in order, with a concise description and a suggestion on how we culd pragmatically automate it.

## Review solution

You present all solutions, we discuss, see which one we use or not, brainstorm how to make it right.

## BMAD Master

Act as BMAD Master, use any logical command in BMAD workflow to rapidly deploy the solution validated in request file.

You spawn sub agent for each command and you pilote them, you take all decision.

The goal is ->

Create a context file for this specific change request
Create a dedicated new epic for this change
Create the stories associated
Create the tech-spec associated
Start the code-story (one by one), you use subagent to review each

You can use any other command that would be benefical. You pilote the flow until its implemented.